import FamilyControls
import SwiftUI
import UIKit

/// Hosts Apple's FamilyActivityPicker so the user can select Instagram once.
final class FamilyActivityPickerViewController: UIViewController {
    var onPicked: ((FamilyActivitySelection) -> Void)?
    var onCancel: (() -> Void)?

    private var selection = FamilyActivitySelection()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.957, green: 0.957, blue: 0.941, alpha: 1)

        let picker = FamilyActivityPicker(selection: Binding(
            get: { self.selection },
            set: { self.selection = $0 }
        ))
        let host = UIHostingController(rootView: picker)
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)

        navigationItem.title = "SELECT INSTAGRAM"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Cancel",
            style: .plain,
            target: self,
            action: #selector(cancelTapped)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Enable",
            style: .done,
            target: self,
            action: #selector(enableTapped)
        )
    }

    @objc private func cancelTapped() {
        onCancel?()
        dismiss(animated: true)
    }

    @objc private func enableTapped() {
        onPicked?(selection)
        dismiss(animated: true)
    }
}

@objc(UncFamilyPicker)
class UncFamilyPickerModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { true }

    @objc
    func presentPicker(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            guard
                let root = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .flatMap({ $0.windows })
                    .first(where: { $0.isKeyWindow })?
                    .rootViewController
            else {
                reject("UNC_PICKER", "No root view controller", nil)
                return
            }

            let picker = FamilyActivityPickerViewController()
            picker.onPicked = { selection in
                do {
                    let data = try PropertyListEncoder().encode(selection)
                    resolve(["selectionBase64": data.base64EncodedString()])
                } catch {
                    reject("UNC_PICKER_ENCODE", error.localizedDescription, error)
                }
            }
            picker.onCancel = {
                resolve(["cancelled": true])
            }

            let nav = UINavigationController(rootViewController: picker)
            nav.modalPresentationStyle = .formSheet
            root.present(nav, animated: true)
        }
    }
}
