import SwiftUI

@main
struct CodexApp: App {
    @State private var store = BookStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
        }
        #if os(macOS)
        .defaultSize(width: 1240, height: 820)
        #endif
        .commands {
            CommandGroup(after: .toolbar) {
                Button("Reload Page") { store.web.reload() }
                    .keyboardShortcut("r", modifiers: .command)
                Divider()
                Button("Actual Size") { store.resetZoom() }
                    .keyboardShortcut("0", modifiers: .command)
                    .disabled(store.textZoom == 1)
                Button("Zoom In") { store.zoomIn() }
                    .keyboardShortcut("+", modifiers: .command)
                    .disabled(!store.canZoomIn)
                Button("Zoom Out") { store.zoomOut() }
                    .keyboardShortcut("-", modifiers: .command)
                    .disabled(!store.canZoomOut)
            }
            CommandMenu("Go") {
                Button("Back") { store.web.goBack() }
                    .keyboardShortcut("[", modifiers: .command)
                    .disabled(!store.canGoBack)
                Button("Forward") { store.web.goForward() }
                    .keyboardShortcut("]", modifiers: .command)
                    .disabled(!store.canGoForward)
                Divider()
                Button("Welcome") { store.open("welcome") }
                Button("Command Atlas") { store.open("atlas") }
                    .keyboardShortcut("1", modifiers: [.command, .shift])
                Button("Practice Hub") { store.open("practice") }
                    .keyboardShortcut("2", modifiers: [.command, .shift])
                Button("Glossary") { store.open("glossary") }
                Button("My Values") { store.open("values") }
            }
        }
    }
}
