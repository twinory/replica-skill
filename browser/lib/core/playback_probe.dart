/// Watches a page for a video that refuses to start, so the app can offer the
/// real app instead of leaving a black rectangle on screen.
///
/// This exists because "does this site play" is not a property of the site. It
/// depends on the DRM the stream uses (FairPlay plays in WKWebView, Widevine
/// does not on iOS), on whether the site decides a given user agent is allowed,
/// and on whether the account is signed in. Guessing writes off sites that work
/// and promises on sites that do not, so the app waits and watches instead.
class PlaybackProbe {
  PlaybackProbe._();

  static const String handlerName = 'huskPlayback';

  /// Reports once per page: 'ok' when something played, 'blocked' with a reason
  /// when the video errored or stayed dead. Silent when there is no video at all,
  /// so a news article never triggers a handoff prompt.
  static const String script = r'''
(function () {
  if (window.__huskProbe) { return false; }
  window.__huskProbe = true;

  var reported = false;
  var started = false;

  function send(kind, detail) {
    if (reported) { return; }
    reported = true;
    try {
      if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler('huskPlayback', { status: kind, detail: String(detail || '') });
      }
    } catch (e) {}
  }

  function attach(video) {
    if (!video || video.__huskWatched) { return; }
    video.__huskWatched = true;
    video.addEventListener('playing', function () { started = true; send('ok', ''); });
    video.addEventListener('error', function () {
      var code = video.error ? video.error.code : 0;
      send('blocked', code === 4 ? 'MEDIA_ERR_SRC_NOT_SUPPORTED' : 'MEDIA_ERR_' + code);
    });
    video.addEventListener('encrypted', function () { started = true; });
  }

  function scan() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) { attach(videos[i]); }
  }

  scan();
  var observer = window.MutationObserver ? new MutationObserver(scan) : null;
  if (observer) { observer.observe(document.documentElement, { childList: true, subtree: true }); }

  // A page with a player that never starts is a failure too. Ten seconds is long
  // enough for a licence exchange, short enough not to feel broken.
  setTimeout(function () {
    if (started || reported) { return; }
    var video = document.querySelector('video');
    if (!video) { return; }
    if (video.readyState === 0 && video.paused) {
      send('blocked', 'player never started');
    }
  }, 10000);

  return true;
})();
''';
}
