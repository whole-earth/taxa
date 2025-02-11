export const cleanupManager = {
    eventListeners: new Map(),
    intersectionObservers: new Set(),
    disposables: new Set(),
    disposedProduct: false,
    disposedCellAndStarfield: false,
    disposeTimeouts: new Map(),
    originalCellVisibility: true,
    originalStarfieldVisibility: false,

    debounce(func, wait) {
        const timeoutKey = func.toString();
        return (...args) => {
            if (this.disposeTimeouts.has(timeoutKey)) {
                clearTimeout(this.disposeTimeouts.get(timeoutKey));
            }
            
            const timeoutId = setTimeout(() => {
                func.apply(this, args);
                this.disposeTimeouts.delete(timeoutKey);
            }, wait);
            
            this.disposeTimeouts.set(timeoutKey, timeoutId);
        };
    },

    addListener(element, type, handler) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Map());
        }
        const elementListeners = this.eventListeners.get(element);
        if (!elementListeners.has(type)) {
            elementListeners.set(type, new Set());
        }
        elementListeners.get(type).add(handler);
        element.addEventListener(type, handler);
    },

    removeListener(element, type, handler) {
        const elementListeners = this.eventListeners.get(element);
        if (elementListeners && elementListeners.has(type)) {
            const handlers = elementListeners.get(type);
            if (handlers.has(handler)) {
                element.removeEventListener(type, handler);
                handlers.delete(handler);
            }
            if (handlers.size === 0) {
                elementListeners.delete(type);
            }
        }
    },

    removeAllListeners(element) {
        if (this.eventListeners.has(element)) {
            const elementListeners = this.eventListeners.get(element);
            elementListeners.forEach((handlers, type) => {
                handlers.forEach(handler => {
                    element.removeEventListener(type, handler);
                });
            });
            this.eventListeners.delete(element);
        }
    },

    addDisposable(object) {
        this.disposables.add(object);
        //console.log('Added disposable object:', object);
    },

    disposeNode(node) {
        if (!node) return;
    
        // Dispose geometries
        if (node.geometry) {
            node.geometry.dispose();
            //console.log('Disposed geometry:', node.geometry);
        }
    
        // Dispose materials
        if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach(material => {
                Object.keys(material).forEach(prop => {
                    if (!material[prop]) return;
                    
                    // Dispose textures
                    if (material[prop].isTexture) {
                        material[prop].dispose();
                        //console.log('Disposed texture:', material[prop]);
                    }
                    // Dispose render targets
                    if (material[prop].isWebGLRenderTarget) {
                        material[prop].dispose();
                        //console.log('Disposed render target:', material[prop]);
                    }
                });
                material.dispose();
                //console.log('Disposed material:', material);
            });
        }
    
        // Remove from parent
        if (node.parent) {
            node.parent.remove(node);
            //console.log('Removed node from parent:', node);
        }
    
        // Clear any references
        node.clear();
        //console.log('Cleared node references:', node);
    },

    disposeHierarchy(object) {
        if (!object) return;
        //console.log('Starting hierarchy disposal for:', object);
        object.traverse(node => {
            this.disposeNode(node);
        });
    },

    _disposeProduct(product) {
        if (!this.disposedProduct && product) {
            //console.log('Disposing product...');
            product.traverse(child => {
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat.dispose) {
                            mat.dispose();
                            //console.log('Disposed product material:', mat);
                        }
                    });
                }
                if (child.geometry) {
                    child.geometry.dispose();
                    //console.log('Disposed product geometry:', child.geometry);
                }
            });
            product.visible = false;
            this.disposedProduct = true;
            //console.log('Product disposal complete');
        } else {
            //console.log('Product already disposed or not available');
        }
    },

    disposeProduct: function(product) {
        this.debounce(this._disposeProduct, 100).call(this, product);
    },

    _disposeCellAndStarfield(cellObject, starField) {
        if (!this.disposedCellAndStarfield) {
            //console.log('Disposing cell and starfield...');
            if (cellObject) {
                this.originalCellVisibility = cellObject.visible;
                cellObject.traverse(child => {
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat.dispose) {
                                mat.dispose();
                                //console.log('Disposed cell material:', mat);
                            }
                        });
                    }
                    if (child.geometry) {
                        child.geometry.dispose();
                        //console.log('Disposed cell geometry:', child.geometry);
                    }
                });
                cellObject.visible = false;
            }
            
            if (starField) {
                this.originalStarfieldVisibility = starField.visible;
                starField.visible = false;
            }
            
            this.disposedCellAndStarfield = true;
            //console.log('Cell and starfield disposal complete');
        } else {
            //console.log('Cell and starfield already disposed');
        }
    },

    reinstateCellAndStarfield(cellObject, starField) {
        if (this.disposedCellAndStarfield) {
            //console.log('Reinstating cell and starfield...');
            if (cellObject) {
                cellObject.visible = this.originalCellVisibility;
            }
            if (starField) {
                starField.visible = this.originalStarfieldVisibility;
            }
            this.disposedCellAndStarfield = false;
            //console.log('Cell and starfield reinstated');
        }
    },

    disposeCellAndStarfield: function(cellObject, starField) {
        this.debounce(this._disposeCellAndStarfield, 100).call(this, cellObject, starField);
    },

    resetDisposalFlags() {
        const prevProductState = this.disposedProduct;
        const prevCellState = this.disposedCellAndStarfield;
        
        this.disposedProduct = false;
        this.disposedCellAndStarfield = false;
        
        // Clear any pending disposal timeouts
        this.disposeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.disposeTimeouts.clear();

    },

    cleanup() {
        //console.log('Starting cleanup process...');
        
        // Clear any pending disposal timeouts
        this.disposeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.disposeTimeouts.clear();
        
        // Clean up event listeners
        this.eventListeners.forEach((elementListeners, element) => {
            this.removeAllListeners(element);
        });
        this.eventListeners.clear();
        //console.log('Cleaned up all event listeners');

        // Clean up intersection observers
        this.intersectionObservers.forEach(observer => {
            observer.disconnect();
            //console.log('Disconnected intersection observer:', observer);
        });
        this.intersectionObservers.clear();
        //console.log('Cleaned up all intersection observers');

        // Clean up Three.js resources
        this.disposables.forEach(object => {
            if (object.isObject3D) {
                this.disposeHierarchy(object);
                //console.log('Disposed 3D object hierarchy:', object);
            } else if (object.dispose) {
                this.disposeNode(object);
                //console.log('Disposed object:', object);
            }
        });
        this.disposables.clear();
        this.resetDisposalFlags();
        //console.log('Cleanup process complete');
    }
}; 