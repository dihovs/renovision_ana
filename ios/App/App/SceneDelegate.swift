import Capacitor
import SwiftUI
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // The app is now rooted in SwiftUI. Screens that have not been ported
        // yet are hosted inside it by WebScreen, which builds its own
        // MainViewController — so this app's Swift plugins are still
        // registered with a Capacitor bridge, just no longer at the root.
        //
        // The storyboard's class is irrelevant either way: the root
        // controller is built here, in code, so this line is what decides.
        window?.rootViewController = UIHostingController(rootView: AppShell())
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
