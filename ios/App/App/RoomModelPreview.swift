import Foundation
import QuickLook

/**
 * A QuickLook data source for one exported room model.
 *
 * QLPreviewController holds its data source WEAKLY, so this object has to be
 * retained by whoever presents it — the plugin keeps it alive. A preview that
 * opens empty is almost always this, not a bad file.
 */
final class RoomModelPreview: NSObject, QLPreviewControllerDataSource {
    let controller = QLPreviewController()
    private let url: URL

    init(url: URL) {
        self.url = url
        super.init()
        controller.dataSource = self
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem {
        url as QLPreviewItem
    }
}
