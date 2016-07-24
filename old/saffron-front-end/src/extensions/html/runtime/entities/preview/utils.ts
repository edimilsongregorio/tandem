
import BoundingRect from 'sf-front-end/geom/bounding-rect';
import { translateStyleToIntegers } from 'sf-front-end/extensions/html/utils/css/translate-style';
import * as CSSParser from '../../parsers/css.peg';
import { HTMLElementExpression, HTMLAttributeExpression, CSSStyleExpression, StringExpression } from '../../expressions/index';
import { HTMLElementEntity, CSSStyleEntity, StringEntity } from '../../entities/index';
import * as sift from 'sift';

import {
  translateStyle,
} from 'sf-front-end/extensions/html/utils/css/index';

import {
  calculateZoom,
  multiplyStyle,
} from 'sf-front-end/utils/html/index';

function translateIntegersToPx(style) {
  var newStyle = {};
  for (var key in style) {
    var value = style[key];
    if (typeof value === 'number') value = value + 'px';
    newStyle[key] = value;
  }
  return newStyle;
}

function getElementOffset(entity, element) {
  var p = element.parentNode;

  var left = 0;
  var top  = 0;

  var zoom = calculateZoom(element);

  while (p) {
    left += p.offsetLeft || 0;
    top  += p.offsetTop  || 0;
    left -= (p.scrollLeft || 0) / zoom;
    top  -= (p.scrollTop  || 0) / zoom;
    p = p.parentNode || p.host;
  }

  const frameOffset = getFrameOffset(entity);
  left += frameOffset.left;
  top  += frameOffset.top;

  return { left, top };
}

function getFrameOffset(entity) {

  entity = entity.parentNode;

  while (entity) {

    if (entity.isolated && entity.preview) {
      var rect = entity.preview.getBoundingRect();
      return rect;
    }

    entity = entity.parentNode;
  }

  return { left: 0, top: 0 };
}

function getComputedStyle(node) {
  var cs:any   = window.getComputedStyle(node);
  // normalize computed styles to pixels
  return Object.assign({}, cs.position,
    translateStyleToIntegers({
      marginLeft: cs.marginLeft,
      marginTop : cs.marginTop,
      marginRight: cs.marginRight,
      marginBottom: cs.marginBottom,
      paddingLeft: cs.paddingLeft,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom
    }, node)
  );
}

export function getCapabilities(node) {
  var style = window.getComputedStyle(node);

  var movable   = style.position !== 'static';
  var resizable = /fixed|absolute/.test(style.position) || !/^inline$/.test(style.display);

  return {
    movable,
    resizable,
  };
}

export function calculateBoundingRect(entity, node, zoomProperties) {

  var rect   = node.getBoundingClientRect();
  var cs     = getComputedStyle(node);
  var offset = getFrameOffset(entity);


  // margins are also considered bounds - add them here. Fixes a few issues
  // when selecting multiple items with different items & dragging them around.
  var left   = rect.left   - cs.marginLeft + offset.left;
  var top    = rect.top    - cs.marginTop + offset.top;
  var right  = rect.right  + cs.marginRight + offset.left;
  var bottom = rect.bottom + cs.marginBottom + offset.top;

  var width = right - left;
  var height = bottom - top;

  if (zoomProperties) {
    ({ left, top, width, height } = (multiplyStyle({ left, top, width, height }, calculateZoom(node))) as any);
  }

  right = left + width;
  bottom = top + height;

  return new BoundingRect(left, top, right, bottom);
}

export function setBoundingRect(bounds, entity, node) {

  // NO zoom here - point is NOT fixed, but relative
  var absStyle = getStyle(entity, node, false);

  var props = Object.assign({}, bounds);

  var paddingWidth = absStyle.paddingLeft + absStyle.paddingRight;
  var paddingHeight = absStyle.paddingTop  + absStyle.paddingBottom;

  props.width = Math.max(props.width - paddingWidth, 0);
  props.height = Math.max(props.height - paddingHeight, 0);

  // convert px to whatever unit is set on the style
  Object.assign(props, translateStyle({
    width: props.width,
    height: props.height,
  }, getEntityStyle(entity), node));


  // FIXME: wrong place here - this is just a quick
  // check to see if this *actually* works
  setPositionFromAbsolutePoint({
    left: bounds.left,
    top : bounds.top,
  }, entity, node);

  delete props.left;
  delete props.top;

  setEntityStyle(entity, props)
}

export function getStyle(entity, node, zoomProperties) {

  var style = getEntityStyle(entity);

  var { left, top } = (translateStyleToIntegers({
    left: style.left || 0,
    top : style.top || 0,
  }, node) as any);

  // normalize computed styles to pixels
  var cStyle = getComputedStyle(node);

  // zooming happens a bit further down
  var rect = calculateBoundingRect(entity, node, false);
  var w = rect.right  - rect.left;
  var h = rect.bottom - rect.top;

  style = Object.assign({}, cStyle, {
    left      : left,
    top       : top,
    width     : w,
    height    : h,

    // for rect consistency
    right     : left + w,
    bottom    : top  + h,
  });

  // this normalizes the properties so that the calculated values
  // are also based on the zoom level. Important for overlay data such as
  // tools and information describing the target entity
  if (zoomProperties) {
    style = multiplyStyle(style, calculateZoom(node));
  }

  return style;
}

function getEntityStyle(entity:HTMLElementEntity):any {

  if (!entity.attributes.style) return {};

  var style = entity.attributes.style.value;
  const styleExpression = CSSParser.parse(style) as CSSStyleExpression;
  const styleEntity = styleExpression.createEntity(entity.symbolTable);
  styleEntity.update();
  return styleEntity.value;
}

function setEntityStyle(entity:HTMLElementEntity, newStyle:Object) {

  var style = entity.attributes.style.value;
  const styleExpression = CSSParser.parse(style) as CSSStyleExpression;
  const styleEntity = styleExpression.createEntity(entity.symbolTable);

  // var combinedStyle = Object.assign()
  styleEntity.update();

  var combinedStyle = Object.assign({}, styleEntity.value, translateIntegersToPx(newStyle));

  var buffer = [];

  for (var key in combinedStyle) {
    var value = combinedStyle[key];
    if (value == undefined) continue;
    buffer.push(key + ':' + value + ';');
  }

  (entity.expression.attributes.find(sift({ key: 'style' })) as HTMLAttributeExpression).value = new StringExpression(buffer.join(' '), undefined);

  entity.update();
}


export function setPositionFromAbsolutePoint(point, entity, node) {

  var element = node;
  var offset  = getElementOffset(entity, node);

  var bounds = calculateBoundingRect(entity, node, false);
  var style  = getStyle(entity, node, false);

  var originLeft = bounds.left - style.left;
  var originTop  = bounds.top  - style.top;

  var left = point.left;
  var top  = point.top;

  left -= offset.left;
  top  -= offset.top;

  // offset relative position (based on children)
  if (/relative|static/.test(style.position)) {
    left -= originLeft - offset.left;
    top -= originTop - offset.top;
  }

  const newStyle = translateStyle({
    left: left,
    top: top,
  }, getEntityStyle(entity) || {}, element);


  setEntityStyle(entity, newStyle);
}


