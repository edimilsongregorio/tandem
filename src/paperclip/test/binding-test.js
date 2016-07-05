import { dom, freeze, createTextBinding, createHTMLBinding, BaseComponent } from '../index';
import CoreObject from 'common/object';
import observable from 'common/object/mixins/observable';

describe(__filename + '#', function() {

  @observable
  class ObservableObject extends CoreObject {

  }

  it('can bind to a simple property', function() {
    var context = ObservableObject.create({ name: 'jake' });
    var div = freeze(<div>hello {createTextBinding('name')}</div>).createView(context);
    expect(div.toString()).to.be('<div>hello jake</div>');
    context.setProperties({ name: 'joe' });
    expect(div.toString()).to.be('<div>hello joe</div>');
  });

  it('can bind to an attribute', function() {
    var context = ObservableObject.create({ color: 'red' });
    var div = freeze(<div style={createTextBinding('color', function(color) {
      return `color:${color}`;
    })}></div>).createView(context);
    expect(div.toString()).to.be('<div style="color:red"></div>');
    context.setProperties({ color: 'blue' });
    expect(div.toString()).to.be('<div style="color:blue"></div>');
  });

  it('can bind to a component attribute', function() {

    class HelloComponent extends BaseComponent {
      static freezeNode() {
        return document.createTextNode('');
      }
      update() {
        this.section.targetNode.nodeValue =  `hello ${this.attributes.text}`;
      }
    }

    var context = ObservableObject.create({ text: 'world' });
    var view = freeze(<HelloComponent text={createTextBinding('text')} />).createView(context);
    expect(view.toString()).to.be('hello world');
    context.setProperties({ text: 'b' });
    expect(view.toString()).to.be('hello b');
  });

  it('can map a DOM node', function() {

    var context = ObservableObject.create({ node: document.createTextNode('a') });

    var view = freeze(createHTMLBinding('node', function(node) {
      return node;
    })).createView(context);

    expect(view.toString()).to.be('a');

    context.setProperties({ node: document.createTextNode('b') });

    expect(view.toString()).to.be('b');
  });
});