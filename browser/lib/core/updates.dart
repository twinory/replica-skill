import 'dart:convert';
import 'dart:io';

import '../models/site.dart';
import 'blocklist.dart';
import 'config.dart';

class UpdateResult {
  const UpdateResult({
    this.patches,
    this.filters,
    this.filtersText,
    this.note = '',
    this.changed = false,
  });

  final PatchBook? patches;
  final BlockList? filters;
  final String? filtersText;
  final String note;
  final bool changed;
}

/// Fetches new filter and patch files from the Worker.
///
/// Every failure is silent by design: a browser that refuses to open because an
/// update server is down is worse than a browser running yesterday's list.
class UpdateService {
  UpdateService(this.client);

  final HttpClient client;

  static UpdateService create() => UpdateService(
        HttpClient()..connectionTimeout = AppConfig.updateTimeout,
      );

  Future<String?> _get(String url) async {
    try {
      final request = await client.getUrl(Uri.parse(url)).timeout(AppConfig.updateTimeout);
      final response = await request.close().timeout(AppConfig.updateTimeout);
      if (response.statusCode != 200) {
        await response.drain<void>();
        return null;
      }
      return await response.transform(utf8.decoder).join().timeout(AppConfig.updateTimeout);
    } catch (_) {
      return null;
    }
  }

  Future<UpdateResult> refresh({required PatchBook currentPatches, required int currentFilterRules}) async {
    final patchesRaw = await _get(AppConfig.patchesUrl);
    final filtersRaw = await _get(AppConfig.filtersUrl);

    PatchBook? nextPatches;
    BlockList? nextFilters;
    var changed = false;
    final notes = <String>[];

    if (patchesRaw != null) {
      try {
        final book = PatchBook.decode(patchesRaw);
        if (book.sites.isNotEmpty && book.version >= currentPatches.version) {
          nextPatches = book;
          changed = changed || book.version > currentPatches.version;
          notes.add('App Mode patches v${book.version}');
        }
      } catch (_) {
        notes.add('Patch file ignored (unreadable)');
      }
    }

    if (filtersRaw != null) {
      try {
        final list = BlockListParser.parse(filtersRaw, label: 'remote');
        if (list.blockRules > 0) {
          nextFilters = list;
          if (list.blockRules != currentFilterRules) {
            changed = true;
          }
          notes.add('${list.blockRules} filter rules');
        }
      } catch (_) {
        notes.add('Filter file ignored (unreadable)');
      }
    }

    return UpdateResult(
      patches: nextPatches,
      filters: nextFilters,
      filtersText: filtersRaw,
      note: notes.join(', '),
      changed: changed,
    );
  }

  void close() => client.close(force: true);
}
