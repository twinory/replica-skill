/// One browser tab. Only the parts worth restoring are serialised; the live
/// web view keeps its own history and scroll position while the tab exists.
class TabModel {
  TabModel({
    required this.id,
    required this.url,
    this.title = '',
    this.isLoading = false,
    this.progress = 0,
    this.canGoBack = false,
    this.canGoForward = false,
    this.appMode = false,
    this.shieldsOn = true,
    this.failed = false,
    this.generation = 0,
  });

  final String id;
  String url;
  String title;
  bool isLoading;
  double progress;
  bool canGoBack;
  bool canGoForward;
  bool appMode;
  bool shieldsOn;
  bool failed;

  /// Bumped when filter lists change. The web view is rebuilt under a new key
  /// so new user scripts really run on the next load.
  int generation;

  String get label {
    if (title.trim().isNotEmpty) {
      return title.trim();
    }
    return url;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'url': url,
        'title': title,
      };

  factory TabModel.fromJson(Map<String, dynamic> json) => TabModel(
        id: json['id'] as String,
        url: json['url'] as String,
        title: json['title'] as String? ?? '',
      );
}
