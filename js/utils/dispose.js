export const cleanupManager = {
    eventListeners: new Map(),
    intersectionObservers: new Set(),
    disposables: new Set(),
    disposedProduct: false,
    disposedCellAndStarfield: false,
    disposeTimeouts: new Map(),
    originalCellVisibility: true,
    originalStarfieldVisibility: false,

    // New caching system
    geometryCache: new Map(),
    materialCache: new Map(),
    textureCache: new Map(),

    // Performance metrics
    metrics: {
        disposalCounts: {},
        cacheMisses: {},
        disposalTimes: {},
        lastOperation: null
    },

    componentStates: {
        cell: {
            isDisposed: false,
            isVisible: true,
            cachedGeometries: new Set(),
            cachedMaterials: new Set(),
            cachedTextures: new Set(),
            lastTransition: null
        },
        product: {
            isDisposed: true,
            isVisible: false,
            cachedGeometries: new Set(),
            cachedMaterials: new Set(),
            cachedTextures: new Set(),
            lastTransition: null
        },
        starfield: {
            isDisposed: true,
            isVisible: false,
            cachedGeometries: new Set(),
            cachedMaterials: new Set(),
            cachedTextures: new Set(),
            lastTransition: null
        },
        speckles: {
            isDisposed: true,
            isVisible: false,
            cachedGeometries: new Set(),
            cachedMaterials: new Set(),
            cachedTextures: new Set(),
            lastTransition: null
        },
        ribbons: {
            isDisposed: true,
            isVisible: false,
            cachedGeometries: new Set(),
            cachedMaterials: new Set(),
            cachedTextures: new Set(),
            lastTransition: null
        }
    },

    // Enhanced cache management with error handling
    cacheGeometry(key, geometry) {
        try {
            // Extract the component name from the key
            const componentKey = key.split('_')[0];
            
            // Verify the component exists in componentStates
            if (!this.componentStates[componentKey]) {
                console.error(`❌ Invalid component key: ${componentKey}`);
                return;
            }

            if (!this.geometryCache.has(key)) {
                console.log(`🔵 Caching geometry for ${key}`);
                const clonedGeometry = geometry.clone();
                this.geometryCache.set(key, clonedGeometry);
                this.componentStates[componentKey].cachedGeometries.add(geometry.uuid);
                this._updateMetrics('geometry', 'cache', key);
            }
        } catch (error) {
            console.error(`❌ Failed to cache geometry for ${key}:`, error);
            this._updateMetrics('geometry', 'error', key);
        }
    },

    cacheMaterial(key, material) {
        try {
            // Extract the component name from the key (everything before the first underscore)
            const componentKey = key.split('_')[0];
            
            // Verify the component exists in componentStates
            if (!this.componentStates[componentKey]) {
                console.error(`❌ Invalid component key: ${componentKey}`);
                return;
            }

            if (!this.materialCache.has(key)) {
                console.log(`🎨 Caching material for ${key}`);
                const clonedMaterial = material.clone();
                
                // Cache associated textures
                Object.entries(material).forEach(([prop, value]) => {
                    if (value && value.isTexture) {
                        const textureKey = `${key}_${prop}`;
                        this.cacheTexture(textureKey, value);
                    }
                });
                
                this.materialCache.set(key, clonedMaterial);
                this.componentStates[componentKey].cachedMaterials.add(material.uuid);
                this._updateMetrics('material', 'cache', key);
            }
        } catch (error) {
            console.error(`❌ Failed to cache material for ${key}:`, error);
            this._updateMetrics('material', 'error', key);
        }
    },

    cacheTexture(key, texture) {
        try {
            // Extract the component name from the key
            const componentKey = key.split('_')[0];
            
            // Verify the component exists in componentStates
            if (!this.componentStates[componentKey]) {
                console.error(`❌ Invalid component key: ${componentKey}`);
                return;
            }

            if (!this.textureCache.has(key)) {
                console.log(`🖼️ Caching texture for ${key}`);
                const clonedTexture = texture.clone();
                this.textureCache.set(key, clonedTexture);
                this.componentStates[componentKey].cachedTextures.add(texture.uuid);
                this._updateMetrics('texture', 'cache', key);
            }
        } catch (error) {
            console.error(`❌ Failed to cache texture for ${key}:`, error);
            this._updateMetrics('texture', 'error', key);
        }
    },

    getCachedGeometry(key) {
        return this.geometryCache.get(key)?.clone();
    },

    getCachedMaterial(key) {
        return this.materialCache.get(key)?.clone();
    },

    // Enhanced disposal with performance tracking
    disposeWithCaching(object, componentKey) {
        if (!object || this.componentStates[componentKey].isDisposed) return;
        
        const startTime = performance.now();
        console.log(`\n🗑️ Starting disposal for ${componentKey}`);
        
        try {
            object.traverse(node => {
                // Handle geometries
                if (node.geometry && !this.componentStates[componentKey].cachedGeometries.has(node.geometry.uuid)) {
                    this.cacheGeometry(`${componentKey}_${node.geometry.uuid}`, node.geometry);
                    node.geometry.dispose();
                }
                
                // Handle materials and textures
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(material => {
                        if (!this.componentStates[componentKey].cachedMaterials.has(material.uuid)) {
                            this.cacheMaterial(`${componentKey}_${material.uuid}`, material);
                            
                            // Dispose textures
                            Object.entries(material).forEach(([prop, value]) => {
                                if (value && value.isTexture) {
                                    value.dispose();
                                }
                            });
                            
                            material.dispose();
                        }
                    });
                }
            });

            object.visible = false;
            this.componentStates[componentKey].isDisposed = true;
            this.componentStates[componentKey].isVisible = false;
            this.componentStates[componentKey].lastTransition = Date.now();
            
            const disposalTime = performance.now() - startTime;
            this._updateMetrics('disposal', 'time', componentKey, disposalTime);
            
            console.log(`✅ Completed disposal for ${componentKey} in ${disposalTime.toFixed(2)}ms\n`);
        } catch (error) {
            console.error(`❌ Error during disposal of ${componentKey}:`, error);
            this._updateMetrics('disposal', 'error', componentKey);
        }
    },

    reinstateWithCache(object, componentKey) {
        if (!object || !this.componentStates[componentKey].isDisposed) return;
        
        console.log(`\n🔄 Reinstating ${componentKey}`);
        
        object.traverse(node => {
            if (node.geometry) {
                const cachedGeometry = this.getCachedGeometry(`${componentKey}_${node.geometry.uuid}`);
                if (cachedGeometry) {
                    node.geometry = cachedGeometry;
                    console.log(`📐 Restored cached geometry for ${componentKey}`);
                }
            }
            
            if (node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach((material, index) => {
                    const cachedMaterial = this.getCachedMaterial(`${componentKey}_${material.uuid}`);
                    if (cachedMaterial) {
                        if (Array.isArray(node.material)) {
                            node.material[index] = cachedMaterial;
                        } else {
                            node.material = cachedMaterial;
                        }
                        console.log(`🎨 Restored cached material for ${componentKey}`);
                    }
                });
            }
        });

        object.visible = true;
        this.componentStates[componentKey].isDisposed = false;
        this.componentStates[componentKey].isVisible = true;
        console.log(`✅ Completed reinstatement for ${componentKey}\n`);
    },

    // Enhanced section-specific disposal methods
    disposeCellAndStarfield(cellObject, starField) {
        this.debounce(() => {
            if (cellObject) this.disposeWithCaching(cellObject, 'cell');
            if (starField) this.disposeWithCaching(starField, 'starfield');
        }, 100)();
    },

    reinstateCellAndStarfield(cellObject, starField) {
        if (cellObject) this.reinstateWithCache(cellObject, 'cell');
        if (starField) this.reinstateWithCache(starField, 'starfield');
    },

    disposeProduct(product) {
        this.disposeWithCaching(product, 'product');
    },

    disposeSpeckles(speckleSystem) {
        if (!speckleSystem || this.componentStates.speckles.isDisposed) return;
        
        console.log('\n✨ Disposing speckle system');
        this.disposeWithCaching(speckleSystem.wavingBlob, 'speckles');
        speckleSystem.dispose();
        console.log('✅ Speckle system disposed\n');
    },

    reinstateSpeckles(speckleSystem) {
        if (!speckleSystem || !this.componentStates.speckles.isDisposed) return;
        
        console.log('\n✨ Reinstating speckle system');
        this.reinstateWithCache(speckleSystem.wavingBlob, 'speckles');
        speckleSystem.initializeSpeckles();
        console.log('✅ Speckle system reinstated\n');
    },

    disposeRibbons(ribbons) {
        this.disposeWithCaching(ribbons, 'ribbons');
    },

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
        console.log('📥 Added disposable object:', object.name || 'unnamed object');
    },

    disposeNode(node) {
        if (!node) return;
    
        console.log(`\n🗑️ Starting node disposal for: ${node.name || 'unnamed node'}`);
    
        // Dispose geometries
        if (node.geometry) {
            node.geometry.dispose();
            console.log('📐 Disposed geometry');
        }
    
        // Dispose materials
        if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material, index) => {
                Object.keys(material).forEach(prop => {
                    if (!material[prop]) return;
                    
                    // Dispose textures
                    if (material[prop].isTexture) {
                        material[prop].dispose();
                        console.log(`🖼️ Disposed texture ${prop}`);
                    }
                    // Dispose render targets
                    if (material[prop].isWebGLRenderTarget) {
                        material[prop].dispose();
                        console.log(`🎯 Disposed render target ${prop}`);
                    }
                });
                material.dispose();
                console.log(`🎨 Disposed material ${index + 1}/${materials.length}`);
            });
        }
    
        // Remove from parent
        if (node.parent) {
            node.parent.remove(node);
            console.log('👋 Removed from parent');
        }
    
        // Clear any references
        node.clear();
        console.log('🧹 Cleared all references\n');
    },

    disposeHierarchy(object) {
        if (!object) return;
        console.log(`\n📦 Starting hierarchy disposal for: ${object.name || 'unnamed object'}`);
        object.traverse(node => {
            this.disposeNode(node);
        });
        console.log('✅ Completed hierarchy disposal\n');
    },

    _disposeProduct(product) {
        if (!this.disposedProduct && product) {
            console.log('\n🎁 Starting product disposal...');
            product.traverse(child => {
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((mat, index) => {
                        if (mat.dispose) {
                            mat.dispose();
                            console.log(`🎨 Disposed product material ${index + 1}/${materials.length} for: ${child.name || 'unnamed child'}`);
                        }
                    });
                }
                if (child.geometry) {
                    child.geometry.dispose();
                    console.log(`📐 Disposed product geometry for: ${child.name || 'unnamed child'}`);
                }
            });
            product.visible = false;
            this.disposedProduct = true;
            console.log('✅ Product disposal complete\n');
        } else {
            console.log('ℹ️ Product already disposed or not available');
        }
    },

    disposeProduct: function(product) {
        this.debounce(this._disposeProduct, 100).call(this, product);
    },

    _disposeCellAndStarfield(cellObject, starField) {
        if (!this.disposedCellAndStarfield) {
            console.log('\n🔄 Starting cell and starfield disposal...');
            if (cellObject) {
                this.originalCellVisibility = cellObject.visible;
                cellObject.traverse(child => {
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach((mat, index) => {
                            if (mat.dispose) {
                                mat.dispose();
                                console.log(`🎨 Disposed cell material ${index + 1}/${materials.length} for: ${child.name || 'unnamed child'}`);
                            }
                        });
                    }
                    if (child.geometry) {
                        child.geometry.dispose();
                        console.log(`📐 Disposed cell geometry for: ${child.name || 'unnamed child'}`);
                    }
                });
                cellObject.visible = false;
                console.log('👁️ Cell visibility set to false');
            }
            
            if (starField) {
                this.originalStarfieldVisibility = starField.visible;
                starField.visible = false;
                console.log('⭐ Starfield visibility set to false');
                if (starField.dispose) {
                    starField.dispose();
                    console.log('🌟 Disposed starfield completely');
                }
            }
            
            this.disposedCellAndStarfield = true;
            console.log('✅ Cell and starfield disposal complete\n');
        } else {
            console.log('ℹ️ Cell and starfield already disposed');
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

    // Performance tracking
    _updateMetrics(type, action, key, value = 1) {
        const metricKey = `${type}_${action}`;
        this.metrics.disposalCounts[metricKey] = (this.metrics.disposalCounts[metricKey] || 0) + value;
        this.metrics.lastOperation = {
            type,
            action,
            key,
            timestamp: Date.now()
        };
    },

    // Memory management
    _cleanupCache() {
        const MAX_CACHE_AGE = 30000; // 30 seconds
        const now = Date.now();

        Object.entries(this.componentStates).forEach(([key, state]) => {
            if (state.lastTransition && (now - state.lastTransition > MAX_CACHE_AGE)) {
                this.geometryCache.delete(key);
                this.materialCache.delete(key);
                this.textureCache.delete(key);
                console.log(`🧹 Cleaned up old cache entries for ${key}`);
            }
        });
    },

    cleanup() {
        console.log('\n🧹 Starting cleanup process...');
        const startTime = performance.now();
        
        try {
            // Clear caches
            this.geometryCache.clear();
            this.materialCache.clear();
            this.textureCache.clear();
            
            // Reset component states
            Object.keys(this.componentStates).forEach(key => {
                this.componentStates[key] = {
                    isDisposed: true,
                    isVisible: false,
                    cachedGeometries: new Set(),
                    cachedMaterials: new Set(),
                    cachedTextures: new Set(),
                    lastTransition: null
                };
            });
            
            // Clear timeouts
            this.disposeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.disposeTimeouts.clear();
            
            // Clean up event listeners
            this.eventListeners.forEach((elementListeners, element) => {
                this.removeAllListeners(element);
            });
            this.eventListeners.clear();
            
            // Clean up observers
            this.intersectionObservers.forEach(observer => observer.disconnect());
            this.intersectionObservers.clear();
            
            // Clean up disposables with error handling
            this.disposables.forEach(object => {
                try {
                    if (object.isObject3D) {
                        this.disposeNode(object);
                    } else if (object.dispose) {
                        object.dispose();
                    }
                } catch (error) {
                    console.error(`❌ Error disposing object:`, error);
                }
            });
            this.disposables.clear();
            
            const cleanupTime = performance.now() - startTime;
            console.log(`✨ Cleanup complete in ${cleanupTime.toFixed(2)}ms\n`);
            
            // Log performance metrics
            console.log('📊 Disposal Metrics:', this.metrics);
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    },

    handleVisibilityAndDisposal(params) {
        const {
            cellObject,
            starField,
            speckleSystem,
            product,
            ribbons,
            wavingBlob,
            splashBool,
            zoomBool,
            pitchBool,
            productBool,
            productProgress,
            section,
            explodedGroups
        } = params;

        // Batch all visibility checks first
        const visibilityStates = {
            cell: splashBool || zoomBool || pitchBool || (productBool && productProgress <= 0.5),
            product: productBool && productProgress > 0.5,
            starfield: productBool && productProgress >= 0 && productProgress <= 0.5,
            speckles: zoomBool || pitchBool,
            ribbons: splashBool
        };

        // Track state changes for performance monitoring
        const stateChanges = [];

        try {
            // Clear exploded dot groups when entering zoom section
            if (section === 'zoom' && explodedGroups) {
                if (explodedGroups.size > 0) {
                    console.log('🧹 Clearing previous exploded dot groups');
                    explodedGroups.clear();
                    if (wavingBlob?.children) {
                        wavingBlob.children.forEach((group, index) => {
                            if (group.isGroup) {
                                group.visible = true;
                            }
                        });
                    }
                    stateChanges.push({ component: 'dot_groups', action: 'clear' });
                }
            }

            // Handle cell and starfield
            if (productBool && productProgress > 0.5 && !this.disposedCellAndStarfield) {
                console.log('🔄 Product progress > 0.5, disposing cell and starfield');
                this.disposeCellAndStarfield(cellObject, starField);
                stateChanges.push({ component: 'cell_and_starfield', action: 'dispose' });
            } else if (productBool && productProgress <= 0.5 && this.disposedCellAndStarfield) {
                console.log('🔄 Product progress <= 0.5, reinstating cell and starfield');
                this.reinstateCellAndStarfield(cellObject, starField);
                if (cellObject) cellObject.visible = true;
                stateChanges.push({ component: 'cell_and_starfield', action: 'reinstate' });
            }

            // Handle cell visibility
            if (cellObject) {
                const shouldBeVisible = visibilityStates.cell;
                const isDisposed = this.componentStates.cell.isDisposed;
                
                if (!shouldBeVisible && !isDisposed) {
                    console.log('🔄 Disposing cell - not in valid section');
                    this.disposeCellAndStarfield(cellObject, starField);
                    stateChanges.push({ component: 'cell', action: 'dispose' });
                } else if (shouldBeVisible && isDisposed) {
                    console.log('🔄 Reinstating cell - entering valid section');
                    this.reinstateCellAndStarfield(cellObject, starField);
                    stateChanges.push({ component: 'cell', action: 'reinstate' });
                }
            }

            // Handle product
            if (product) {
                const shouldBeVisible = visibilityStates.product;
                const isDisposed = this.componentStates.product.isDisposed;
                
                if (!shouldBeVisible && !isDisposed) {
                    console.log('📦 Disposing product - not in valid section/progress');
                    this.disposeProduct(product);
                    stateChanges.push({ component: 'product', action: 'dispose' });
                } else if (shouldBeVisible && isDisposed) {
                    console.log('📦 Reinstating product');
                    this.reinstateWithCache(product, 'product');
                    stateChanges.push({ component: 'product', action: 'reinstate' });
                }
            }

            // Handle speckle system
            if (speckleSystem) {
                const shouldBeVisible = visibilityStates.speckles;
                const isDisposed = this.componentStates.speckles.isDisposed;
                
                if (!shouldBeVisible && !isDisposed) {
                    console.log('✨ Disposing speckle system - not in zoom/pitch section');
                    this.disposeSpeckles(speckleSystem);
                    stateChanges.push({ component: 'speckles', action: 'dispose' });
                } else if (shouldBeVisible && isDisposed) {
                    console.log('✨ Reinstating speckle system - entering zoom/pitch section');
                    this.reinstateSpeckles(speckleSystem);
                    stateChanges.push({ component: 'speckles', action: 'reinstate' });
                }
            }

            // Section-specific cleanup
            if (section === 'splash') {
                if (ribbons && !visibilityStates.ribbons && !this.componentStates.ribbons.isDisposed) {
                    console.log('🎗️ Disposing ribbons - not in splash section');
                    this.disposeRibbons(ribbons);
                    stateChanges.push({ component: 'ribbons', action: 'dispose' });
                }
            } else if (section === 'zoom' && wavingBlob?.children && explodedGroups) {
                wavingBlob.children.forEach((group, index) => {
                    if (group.isGroup && explodedGroups.has(index)) {
                        if (!this.componentStates.speckles.isDisposed) {
                            console.log(`🔴 Disposing exploded dot group ${index}`);
                            this.disposeWithCaching(group, 'speckles');
                            group.visible = false;
                            stateChanges.push({ component: 'dot_group', index, action: 'dispose' });
                        }
                    }
                });
            }

            // Periodic cache cleanup
            this._cleanupCache();

            if (stateChanges.length > 0) {
                console.log('🔄 State changes this frame:', stateChanges);
            }

        } catch (error) {
            console.error('❌ Error in handleVisibilityAndDisposal:', error);
        }

        return stateChanges;
    }
}; 