import { Text as Text$1, preloadFont } from 'troika-three-text';

// @ts-ignore
const externalProps = ['onSync', 'onPreloadEnd', 'characters'];
function removeExternalProps(props) {
  return Object.keys(props).reduce((result, key) => {
    if (externalProps.indexOf(key) === -1) {
      result[key] = props[key];
    }
    return result;
  }, {});
}
const Text = ({
  sdfGlyphSize = 64,
  anchorX = 'center',
  anchorY = 'middle',
  fontSize = 1,
  ...restProps
}) => {
  const props = {
    sdfGlyphSize,
    anchorX,
    anchorY,
    fontSize,
    ...restProps
  };
  const troikaMesh = new Text$1();
  Object.assign(troikaMesh, removeExternalProps(props));
  if (props.font && props.characters) {
    preloadFont({
      font: props.font,
      characters: props.characters
    }, () => {
      props.onPreloadEnd && props.onPreloadEnd();
    });
  }
  return {
    mesh: troikaMesh,
    updateProps(newProps) {
      Object.assign(troikaMesh, removeExternalProps(newProps));
      troikaMesh.sync(() => {
        props.onSync && props.onSync(troikaMesh);
      });
    },
    dispose() {
      troikaMesh.dispose();
    }
  };
};

export { Text };
