/// The element picker.
///
/// App view is only as good as its per site rules, and the sites a person opens
/// daily are not the sites anyone writes patches for. So the app ships a picker:
/// tap a thing that should not be there, and it is hidden on that site from then
/// on, without a release, a patch, or a maintainer.
///
/// The script is deliberately paranoid. It never mutates page data, it puts
/// everything back when it stops, and every failure returns to the page instead
/// of throwing. The only thing it ever sends to the app is a CSS selector.
class Picker {
  Picker._();

  static const String handlerName = 'huskPick';

  /// Selectors that are auto generated and change on every deploy. Hiding by
  /// those would break the next time the site ships, so they are filtered out.
  static const List<String> _unstable = <String>[
    'css-', 'sc-', 'jsx-', 'ember', 'react-', 'styled-', '__', '--',
  ];

  static bool isStableToken(String token) {
    if (token.isEmpty || token.length > 28) {
      return false;
    }
    final lower = token.toLowerCase();
    for (final marker in _unstable) {
      if (lower.contains(marker)) {
        return false;
      }
    }
    // A long run of digits or an md5 looking string is generated.
    if (RegExp(r'[0-9]{4,}').hasMatch(token)) {
      return false;
    }
    if (RegExp(r'^[a-f0-9]{8,}$').hasMatch(lower)) {
      return false;
    }
    return RegExp(r'^[a-zA-Z][a-zA-Z0-9_-]*$').hasMatch(token);
  }

  static String script() {
    return r'''
(function () {
  var OLD = window.__huskPicker;
  if (OLD && typeof OLD.stop === 'function') { OLD.stop(); }

  var MARK = 'husk-picker-target';
  var target = null;
  var done = false;
  var bar = null;
  var style = null;

  function send(payload) {
    try {
      if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler('huskPick', payload);
      }
    } catch (e) {}
  }

  function stable(token) {
    if (!token || token.length > 28) { return false; }
    var lower = token.toLowerCase();
    var markers = ['css-', 'sc-', 'jsx-', 'ember', 'react-', 'styled-', '__', '--'];
    for (var i = 0; i < markers.length; i++) {
      if (lower.indexOf(markers[i]) !== -1) { return false; }
    }
    if (/[0-9]{4,}/.test(token)) { return false; }
    if (/^[a-f0-9]{8,}$/.test(lower)) { return false; }
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(token);
  }

  function classesOf(el) {
    var out = [];
    var list = (el.getAttribute('class') || '').split(/\s+/);
    for (var i = 0; i < list.length; i++) {
      if (stable(list[i])) { out.push(list[i]); }
    }
    return out;
  }

  function nth(el) {
    var parent = el.parentNode;
    if (!parent) { return ''; }
    var count = 0;
    var total = 0;
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].nodeName === el.nodeName) {
        total++;
        if (parent.children[i] === el) { count = total; }
      }
    }
    return total > 1 ? ':nth-of-type(' + count + ')' : '';
  }

  function oneSelector(el) {
    var id = el.getAttribute('id') || '';
    if (id && stable(id)) { return '#' + id; }
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var piece = node.nodeName.toLowerCase();
      var cls = classesOf(node);
      if (cls.length) { piece += '.' + cls.slice(0, 2).join('.'); }
      if (!cls.length || depth > 0) { piece += nth(node); }
      parts.unshift(piece);
      if (id && stable(id)) { parts[0] = '#' + id; break; }
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function allSelector(el) {
    var cls = classesOf(el);
    if (cls.length) {
      return el.nodeName.toLowerCase() + '.' + cls[0];
    }
    var attr = el.getAttribute('data-testid') || el.getAttribute('aria-label');
    if (attr) {
      return el.nodeName.toLowerCase() + '[aria-label="' + attr.replace(/"/g, '') + '"]';
    }
    return oneSelector(el);
  }

  function paint(el) {
    var previous = document.querySelectorAll('.' + MARK);
    for (var i = 0; i < previous.length; i++) {
      previous[i].classList.remove(MARK);
    }
    if (el) { el.classList.add(MARK); }
  }

  function elementAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body && el !== document.documentElement) {
      if (el === bar || (bar && bar.contains(el))) { return null; }
      var rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 16) { return el; }
      el = el.parentElement;
    }
    return el;
  }

  function onMove(event) {
    if (done) { return; }
    var el = elementAt(event.clientX, event.clientY);
    if (el && el !== target) { target = el; paint(el); }
  }

  function onTap(event) {
    if (done) { return; }
    if (bar && bar.contains(event.target)) { return; }
    event.preventDefault();
    event.stopPropagation();
    var el = elementAt(event.clientX, event.clientY);
    if (!el) { return; }
    target = el;
    paint(el);
    showBar(el);
  }

  function button(label, action, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'all:unset;cursor:pointer;padding:9px 14px;border-radius:10px;font:600 13px -apple-system,system-ui,sans-serif;' +
      (primary
        ? 'background:#8ea9ff;color:#0b1024;'
        : 'background:rgba(255,255,255,0.10);color:#eef1f6;');
    b.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    return b;
  }

  function showBar(el) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'husk-picker-bar';
      bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));' +
        'z-index:2147483647;display:flex;gap:8px;align-items:center;justify-content:flex-end;' +
        'padding:10px;border-radius:16px;background:rgba(10,12,16,0.96);' +
        'border:1px solid rgba(255,255,255,0.16);box-shadow:0 12px 30px rgba(0,0,0,0.5);' +
        'font:600 12px -apple-system,system-ui,sans-serif;color:#98a2b3;';
      document.body.appendChild(bar);
    }
    bar.innerHTML = '';
    var hint = document.createElement('span');
    hint.textContent = 'Hide this?';
    hint.style.cssText = 'margin-right:auto;padding-left:4px;';
    bar.appendChild(hint);
    bar.appendChild(button('All like it', function () {
      send({ selector: allSelector(el), mode: 'all' });
      finish();
    }));
    bar.appendChild(button('This one', function () {
      send({ selector: oneSelector(el), mode: 'one' });
      finish();
    }));
    bar.appendChild(button('Cancel', finish));
  }

  function finish() {
    done = true;
    paint(null);
    if (bar && bar.parentNode) { bar.parentNode.removeChild(bar); }
    if (style && style.parentNode) { style.parentNode.removeChild(style); }
    document.removeEventListener('click', onTap, true);
    document.removeEventListener('touchstart', onTap, true);
    document.removeEventListener('mousemove', onMove, true);
    window.__huskPicker = null;
  }

  style = document.createElement('style');
  style.id = 'husk-picker-style';
  style.textContent = '.' + MARK + '{outline:2px solid #8ea9ff !important;' +
    'outline-offset:-2px !important;background:rgba(142,169,255,0.12) !important;' +
    'cursor:crosshair !important;}';
  (document.head || document.documentElement).appendChild(style);

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onTap, true);
  document.addEventListener('touchstart', onTap, true);

  window.__huskPicker = { stop: finish };
  return true;
})();
''';
  }
}
