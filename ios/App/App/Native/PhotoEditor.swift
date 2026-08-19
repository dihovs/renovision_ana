import CoreImage
import CoreImage.CIFilterBuiltins
import PencilKit
import SwiftUI
import UIKit

/// Looking at a claim photo, and marking it up.
///
/// Built to `Docs/reference/magicplan/object-model.md` §2a, which maps their
/// editor in full: chrome is `Cancel · undo · redo · Done`, and four MODES
/// switched by the icon row at the very bottom — Draw, Pixelate, Crop and
/// transform, Adjustments — each replacing the controls above it.
///
/// **Blur came first, alone, and that was deliberate.** S6's own instruction,
/// because blur is not a nice-to-have on this job: a restoration photo
/// routinely catches a driver's licence on a kitchen counter, a face, or a
/// plate through a window, and with no way to redact, the only safe thing an
/// operator can do is NOT TAKE THE PHOTO. That is evidence lost off a claim.
///
/// Three of the four modes are now live — Draw, Pixelate, Adjust. **Crop is
/// still empty**, drawn in its place and greyed: the rule this app already
/// follows for `Add Wall` and `Split Room` on the plan editor's bar. The row
/// the owner learns is the row the reference has, and a mode that is merely
/// absent teaches a layout that changes under him later.
///
/// Within Draw, the same rule again: PencilKit gives Sharpie and Eraser
/// honestly, and §2a's other six tools (Arrow, Text, Rectangle, Path, Line,
/// Ellipse) are drawn greyed until they are written, rather than dropped.
struct PhotoEditorView: View {
    /// The photo being edited, at whatever resolution it was stored.
    let original: UIImage
    /// Where the edited copy gets filed. The same coordinates the photo was
    /// uploaded under, so it lands exactly where the original was.
    let projectId: String
    let roomScanId: String?
    let affectedAreaId: String?
    let wallIndex: Int?
    /// The photo this replaces. Deleted only after the new copy has been
    /// accepted by the server — see `commit`.
    let replacing: RoomPhoto
    let onFinished: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .pixelate

    /// Everything the operator has done, in one value.
    ///
    /// One snapshot type rather than three parallel stacks, so `undo` means
    /// the same thing whichever mode it is pressed in — the plan editor's
    /// own idiom, and for the same reason: a history that only remembers
    /// some of the state restores a screen that never existed.
    @State private var edit = EditState()
    @State private var history: [EditState] = []
    @State private var future: [EditState] = []

    @State private var dragging: CGRect?
    @State private var preview: UIImage?
    /// A downscaled copy of the photo that the live preview is rendered
    /// from. A 2048px image through five Core Image filters on every tick of
    /// a slider drops frames on a phone; the full-resolution pipeline runs
    /// once, at Done.
    @State private var previewBase: UIImage?

    @State private var channel: Adjustments.Channel = .brightness
    @State private var ink: Color = .red
    @State private var width: LineWidth = .medium
    @State private var tool: DrawTool = .sharpie

    @State private var saving = false
    @State private var error: String?
    @State private var confirmingDone = false
    /// What the picture actually occupies on screen — which is also the
    /// coordinate space PencilKit's strokes are in, since the canvas is
    /// sized to the picture. Needed at Done to scale a drawing made at
    /// 350pt onto a 2048px photograph; without it every stroke composites
    /// at a sixth of its size in the corner of the image.
    @State private var drawnSize: CGSize = .zero
    /// The shape being dragged out right now, before it is committed.
    @State private var pendingShape: Annotation?
    /// A text mark waiting for its words.
    @State private var typing: Annotation?
    @State private var typedText = ""
    /// Which crop handle is in the hand, as a corner index 0…3.
    @State private var cropHandle: Int?

    // MARK: - The state one edit is made of

    /// One drawn mark: an arrow, a line, a box, an ellipse, a word.
    ///
    /// §2a's shape tools. PencilKit gives freehand and the eraser honestly;
    /// these five have no system equivalent and are ours, which is what its
    /// own table said when this section was scoped.
    ///
    /// Held in the image's OWN pixels like the redactions, so what is drawn
    /// and what is saved are the same arithmetic rather than two.
    struct Annotation: Identifiable {
        let id = UUID()
        var kind: DrawTool
        /// Where the drag began and where it ended. Every one of these five
        /// is defined by two corners — an arrow points from a to b, a box
        /// spans them, a word sits at a.
        var a: CGPoint
        var b: CGPoint
        var color: Color
        var width: CGFloat
        var text: String = ""
    }

    struct EditState {
        /// Redactions in the image's OWN pixel coordinates rather than the
        /// screen's — so the preview and the full-resolution render are the
        /// same arithmetic, and a redaction cannot land somewhere else in
        /// the file than where the finger drew it.
        var redactions: [CGRect] = []
        var adjustments = Adjustments()
        /// PencilKit's own model. Held here rather than left inside the
        /// canvas so undo can put a previous drawing back.
        var drawing = PKDrawing()
        /// The shape tools' marks, in the order they were made.
        var shapes: [Annotation] = []
        /// Quarter turns anticlockwise, and whether the picture is mirrored
        /// — §2a's `Rotate left` and `Flip horizontal`.
        var quarterTurns = 0
        var flipped = false
        /// Fine straightening in degrees, which is what their dial reading
        /// `0°` under the Rotation tab does.
        var straighten: Double = 0
        /// The kept rectangle, in the image's own pixels. Nil means the
        /// whole picture — an uncropped photo should carry no crop, not a
        /// crop that happens to be the full frame.
        var crop: CGRect?

        var isEmpty: Bool {
            redactions.isEmpty && adjustments.isIdentity && drawing.strokes.isEmpty
                && shapes.isEmpty && quarterTurns == 0 && !flipped && straighten == 0
                && crop == nil
        }
    }

    /// §2a's Adjustments mode: "a value dial at 0 and five channels".
    ///
    /// Every channel is held as −100…100 with 0 meaning untouched, and
    /// mapped to its filter's own units at render time. That keeps the dial
    /// honest — one control, one range, centre is neutral — where exposing
    /// `CIColorControls`'s native scales would give contrast a neutral of 1
    /// and brightness a neutral of 0 on the same row.
    struct Adjustments {
        var brightness = 0.0
        var contrast = 0.0
        var saturation = 0.0
        var exposure = 0.0
        var temperature = 0.0

        var isIdentity: Bool {
            Channel.allCases.allSatisfy { self[$0] == 0 }
        }

        enum Channel: String, CaseIterable, Hashable {
            case brightness = "Brightness"
            case contrast = "Contrast"
            case saturation = "Saturation"
            case exposure = "Exposure"
            case temperature = "Temperature"
        }

        subscript(channel: Channel) -> Double {
            get {
                switch channel {
                case .brightness: return brightness
                case .contrast: return contrast
                case .saturation: return saturation
                case .exposure: return exposure
                case .temperature: return temperature
                }
            }
            set {
                switch channel {
                case .brightness: brightness = newValue
                case .contrast: contrast = newValue
                case .saturation: saturation = newValue
                case .exposure: exposure = newValue
                case .temperature: temperature = newValue
                }
            }
        }
    }

    /// §2a's seven named line widths, in its own order and wording.
    enum LineWidth: String, CaseIterable, Hashable {
        case extraSmall = "Extra small"
        case small = "Small"
        case mediumSmall = "Medium small"
        case medium = "Medium"
        case mediumLarge = "Medium large"
        case large = "Large"
        case extraLarge = "Extra large"

        /// Points at the drawn size. Doubling roughly per step, because a
        /// linear ramp makes the small end indistinguishable and the large
        /// end useless.
        var points: CGFloat {
            switch self {
            case .extraSmall: return 2
            case .small: return 4
            case .mediumSmall: return 7
            case .medium: return 11
            case .mediumLarge: return 18
            case .large: return 28
            case .extraLarge: return 44
            }
        }
    }

    /// §2a's complete tool row, in the order it was observed, scrolled to
    /// its end: `Sharpie · Arrow · Text · Rectangle · Eraser · Path · Line ·
    /// Ellipse`. Two are built.
    enum DrawTool: String, CaseIterable, Hashable {
        case sharpie = "Sharpie"
        case arrow = "Arrow"
        case text = "Text"
        case rectangle = "Rectangle"
        case eraser = "Eraser"
        case path = "Path"
        case line = "Line"
        case ellipse = "Ellipse"

        var icon: String {
            switch self {
            case .sharpie: return "highlighter"
            case .arrow: return "arrow.up.right"
            case .text: return "textformat"
            case .rectangle: return "rectangle"
            case .eraser: return "eraser"
            case .path: return "scribble.variable"
            case .line: return "line.diagonal"
            case .ellipse: return "circle"
            }
        }

        /// PencilKit gives Sharpie and Eraser honestly — pressure,
        /// smoothing and a stroke that does not look hand-rolled. Arrow,
        /// Text, Rectangle, Line and Ellipse are ours, and are now written.
        ///
        /// `Path` — their multi-point polyline, placed a tap at a time — is
        /// the one still missing, and is left greyed rather than guessed:
        /// Sharpie already covers freehand, and a polyline needs a
        /// placement interaction nobody has observed.
        var isBuilt: Bool { self != .path }

        /// Whether this tool draws one of OUR shapes rather than driving
        /// PencilKit.
        var isShape: Bool {
            switch self {
            case .arrow, .text, .rectangle, .line, .ellipse: return true
            default: return false
            }
        }
    }

    /// §2a's four modes, in the reference's own order.
    enum Mode: CaseIterable, Hashable {
        case draw
        case pixelate
        case crop
        case adjust

        var label: String {
            switch self {
            case .draw: return "Draw"
            case .pixelate: return "Pixelate"
            case .crop: return "Crop"
            case .adjust: return "Adjust"
            }
        }

        var icon: String {
            switch self {
            case .draw: return "scribble"
            case .pixelate: return "mosaic"
            case .crop: return "crop.rotate"
            case .adjust: return "dial.min"
            }
        }

        /// Crop is the one still unwritten: there is no public system
        /// cropper, and §2a's own table puts it at medium effort beside the
        /// two that came free.
        var isBuilt: Bool { self != .crop }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                canvas
                Divider()
                controls
                modeRow
            }
            .background(Brand.canvas)
            .navigationTitle("Edit Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                // §2a puts undo and redo in the chrome, between Cancel and
                // Done — not in the tool area, where they would come and go
                // with the mode.
                ToolbarItemGroup(placement: .principal) {
                    Button { undo() } label: { Image(systemName: "arrow.uturn.backward") }
                        .disabled(history.isEmpty)
                    Button { redo() } label: { Image(systemName: "arrow.uturn.forward") }
                        .disabled(future.isEmpty)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView().controlSize(.small)
                    } else {
                        Button("Done") { confirmingDone = true }
                            .fontWeight(.semibold)
                            .disabled(edit.isEmpty)
                    }
                }
            }
            // Saving REPLACES: the edited copy is uploaded and the original
            // deleted. For a redaction that is the entire point — a blurred
            // copy sitting beside a readable original redacts nothing — and
            // it is not something to discover afterwards, so it is said
            // first, in the words that fit what was actually done.
            .confirmationDialog(
                edit.redactions.isEmpty
                    ? "Replace the original with the edited copy?"
                    : "Replace the original with the redacted copy?",
                isPresented: $confirmingDone, titleVisibility: .visible
            ) {
                Button("Replace and delete original", role: .destructive) {
                    Task { await commit() }
                }
                Button("Keep editing", role: .cancel) {}
            } message: {
                Text(
                    edit.redactions.isEmpty
                        ? "The photo you started from is deleted from the server. This cannot be undone."
                        : "The unblurred photo is deleted from the server. That is the point of blurring it — but it cannot be undone."
                )
            }
            .alert(
                "Could not save",
                isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })
            ) {
                Button("OK", role: .cancel) { error = nil }
            } message: {
                Text(error ?? "")
            }
            .task { prepare() }
            // A text mark asks for its words once its box is drawn — put it
            // where it goes, then say what it says.
            .alert(
                "Add text",
                isPresented: Binding(get: { typing != nil }, set: { if !$0 { typing = nil } })
            ) {
                TextField("Text", text: $typedText)
                Button("Add") {
                    if var shape = typing, !typedText.isEmpty {
                        shape.text = typedText
                        push()
                        edit.shapes.append(shape)
                    }
                    typing = nil
                }
                Button("Cancel", role: .cancel) { typing = nil }
            }
        }
        .interactiveDismissDisabled(!edit.isEmpty)
    }

    // MARK: - The image, and the finger on it

    private var canvas: some View {
        GeometryReader { proxy in
            // The drawn rect, not the offered one. `scaledToFit` means the
            // image occupies less than it was given on one axis, and an
            // overlay positioned in the OFFER lands off the picture by
            // however much — the S4 bug, which cost a session on the plan
            // editor and would repeat here exactly.
            let drawn = Self.fitted(image: original.size, in: proxy.size)

            ZStack {
                Color.black
                ZStack {
                    Image(uiImage: preview ?? original)
                        .resizable()
                        .scaledToFit()

                    // PencilKit sits ON the picture, at the picture's drawn
                    // size, so a stroke's coordinates are the picture's own
                    // and scale to the full-resolution render by one factor.
                    // Transparent, and it only takes touches in Draw mode —
                    // otherwise it would swallow the redaction drag beneath
                    // it.
                    DrawingCanvas(
                        drawing: $edit.drawing,
                        tool: tool,
                        ink: ink,
                        width: width,
                        isActive: mode == .draw,
                        onStrokeFinished: { pushHistoryKeepingCurrent() })
                }
                .frame(width: drawn.width, height: drawn.height)
                .onAppear { drawnSize = drawn.size }
                .onChange(of: drawn.size) { _, new in drawnSize = new }
                .overlay(alignment: .topLeading) {
                    // The rectangle being dragged right now, as an outline
                    // over the picture. Committed ones are not drawn here —
                    // they are IN the preview image, which is what makes
                    // what you see what you get.
                    if let dragging {
                        let onScreen = Self.toScreen(dragging, image: original.size, drawn: drawn)
                        Rectangle()
                            .strokeBorder(Color.yellow, lineWidth: 2)
                            .frame(width: onScreen.width, height: onScreen.height)
                            .offset(x: onScreen.minX, y: onScreen.minY)
                    }
                }
                // The shapes, live. Drawn as an overlay rather than baked
                // into the preview so a mark can be undone without
                // re-rendering the photograph underneath it.
                .overlay {
                    Canvas { context, _ in
                        let scale = drawn.width / max(original.size.width, 1)
                        for shape in edit.shapes + [pendingShape].compactMap({ $0 }) {
                            Self.drawShape(shape, in: context, scale: scale, size: drawn.size)
                        }
                    }
                    .allowsHitTesting(false)
                }
                // §2a's crop frame: the kept rectangle, everything outside
                // it dimmed, a handle at each corner.
                .overlay {
                    if mode == .crop {
                        cropFrame(drawn: drawn)
                    }
                }
                .contentShape(.rect)
                .gesture(canvasGesture(drawn: drawn))
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }

    // MARK: - Gestures

    /// One drag, meaning whatever the mode says it means.
    ///
    /// Branching inside a single `DragGesture` rather than choosing between
    /// several: `some Gesture` is an opaque type and two of them are two
    /// different types, which a ternary will not unify — the same lesson
    /// `ElevationView.faceGesture` records.
    private func canvasGesture(drawn: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { value in
                switch mode {
                case .pixelate:
                    dragging = Self.rect(
                        from: value.startLocation, to: value.location,
                        image: original.size, drawn: drawn)

                case .draw where tool.isShape:
                    let a = Self.imagePoint(value.startLocation, image: original.size, drawn: drawn)
                    let b = Self.imagePoint(value.location, image: original.size, drawn: drawn)
                    // Width is in the picture's pixels, not the screen's, so
                    // a "Medium" line is the same weight on the saved photo
                    // whatever the phone was zoomed to when it was drawn.
                    let scale = original.size.width / max(drawn.width, 1)
                    pendingShape = Annotation(
                        kind: tool, a: a, b: b, color: ink,
                        width: width.points * scale,
                        text: tool == .text ? typedText : "")

                case .crop:
                    dragCropHandle(to: value.location, drawn: drawn)

                default:
                    break
                }
            }
            .onEnded { _ in
                switch mode {
                case .pixelate:
                    if let dragging, dragging.width > 4, dragging.height > 4 {
                        push()
                        edit.redactions.append(dragging)
                        rebuildPreview()
                    }
                    dragging = nil

                case .draw where tool.isShape:
                    guard let shape = pendingShape else { break }
                    pendingShape = nil
                    // A text mark is not finished until it has words. Asking
                    // for them here, once the box is drawn, is the order the
                    // hand expects: put it where it goes, then say what it
                    // says.
                    if shape.kind == .text {
                        typedText = ""
                        typing = shape
                    } else {
                        push()
                        edit.shapes.append(shape)
                    }

                case .crop:
                    cropHandle = nil

                default:
                    break
                }
            }
    }

    /// Move whichever crop corner the finger is nearest, keeping the
    /// rectangle inside the picture and never letting it collapse.
    private func dragCropHandle(to location: CGPoint, drawn: CGRect) {
        let full = CGRect(origin: .zero, size: original.size)
        var rect = edit.crop ?? full
        let point = Self.imagePoint(location, image: original.size, drawn: drawn)

        if cropHandle == nil {
            // Nearest corner wins, decided once at the start of the drag so
            // a fast finger cannot hand the rectangle to a different corner
            // halfway through.
            let corners = [
                CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
                CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY),
            ]
            cropHandle = corners.enumerated().min {
                hypot($0.element.x - point.x, $0.element.y - point.y)
                    < hypot($1.element.x - point.x, $1.element.y - point.y)
            }?.offset
            if edit.crop == nil { push() }
        }

        // A floor of 64px on each side: a crop nobody can see is a crop
        // nobody meant.
        let x = min(max(point.x, full.minX), full.maxX)
        let y = min(max(point.y, full.minY), full.maxY)
        switch cropHandle {
        case 0: rect = CGRect(x: min(x, rect.maxX - 64), y: min(y, rect.maxY - 64),
                              width: rect.maxX - min(x, rect.maxX - 64),
                              height: rect.maxY - min(y, rect.maxY - 64))
        case 1: rect = CGRect(x: rect.minX, y: min(y, rect.maxY - 64),
                              width: max(x - rect.minX, 64),
                              height: rect.maxY - min(y, rect.maxY - 64))
        case 2: rect = CGRect(x: rect.minX, y: rect.minY,
                              width: max(x - rect.minX, 64), height: max(y - rect.minY, 64))
        case 3: rect = CGRect(x: min(x, rect.maxX - 64), y: rect.minY,
                              width: rect.maxX - min(x, rect.maxX - 64),
                              height: max(y - rect.minY, 64))
        default: break
        }
        edit.crop = rect.intersection(full)
    }

    /// The crop rectangle over the picture: everything outside it dimmed,
    /// a handle at each corner.
    private func cropFrame(drawn: CGRect) -> some View {
        let rect = Self.toScreen(
            edit.crop ?? CGRect(origin: .zero, size: original.size),
            image: original.size, drawn: drawn)
        return ZStack(alignment: .topLeading) {
            // The dimming, as one shape with the kept rectangle knocked out
            // of it — `.evenOdd` rather than four rectangles around the
            // hole, which never quite meet at the corners.
            Path { p in
                p.addRect(CGRect(origin: .zero, size: drawn.size))
                p.addRect(rect)
            }
            .fill(Color.black.opacity(0.45), style: FillStyle(eoFill: true))

            Rectangle()
                .strokeBorder(.white, lineWidth: 1.5)
                .frame(width: rect.width, height: rect.height)
                .offset(x: rect.minX, y: rect.minY)

            ForEach(0..<4, id: \.self) { corner in
                let p = [
                    CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
                    CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY),
                ][corner]
                Rectangle()
                    .fill(.white)
                    .frame(width: 18, height: 4)
                    .offset(x: p.x - 9, y: p.y - 2)
                Rectangle()
                    .fill(.white)
                    .frame(width: 4, height: 18)
                    .offset(x: p.x - 2, y: p.y - 9)
            }
        }
        .frame(width: drawn.width, height: drawn.height)
        .allowsHitTesting(false)
    }

    // MARK: - The mode's own controls

    @ViewBuilder private var controls: some View {
        switch mode {
        case .pixelate:
            // §2a: "No options at all: the tool row disappears and you drag
            // directly on the image." So this is a caption, not a toolbar —
            // saying the one thing the operator needs to know, since a mode
            // with no controls otherwise looks like a mode that is broken.
            captionBlock(
                "Drag across anything that must not be readable.",
                edit.redactions.isEmpty
                    ? "Faces, documents, licence plates."
                    : "\(edit.redactions.count) area\(edit.redactions.count == 1 ? "" : "s") blurred · Done replaces the original")

        case .draw:
            drawControls

        case .adjust:
            adjustControls

        case .crop:
            captionBlock(
                "Crop isn't built yet",
                "There is no system cropper to borrow — this one is ours to write.")
        }
    }

    private func captionBlock(_ title: String, _ detail: String) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text(detail)
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkSoft)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Brand.Space.base)
        .padding(.horizontal, Brand.Space.base)
    }

    /// §2a's Draw mode: line colour, line width, then the scrolling tool row.
    private var drawControls: some View {
        VStack(spacing: Brand.Space.small) {
            HStack(spacing: Brand.Space.base) {
                // `ColorPicker` IS the reference's colour control — spectrum
                // field, hue slider, opacity, and a preset palette — so it
                // is taken whole rather than rebuilt.
                ColorPicker("Line color", selection: $ink, supportsOpacity: true)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.ink)

                Menu {
                    ForEach(LineWidth.allCases, id: \.self) { candidate in
                        Button {
                            width = candidate
                        } label: {
                            if width == candidate {
                                Label(candidate.rawValue, systemImage: "checkmark")
                            } else {
                                Text(candidate.rawValue)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(width.rawValue)
                            .font(.system(size: 14, weight: .semibold))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 11))
                    }
                    .foregroundStyle(Brand.blue)
                }
            }
            .padding(.horizontal, Brand.Space.base)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Brand.Space.tight) {
                    ForEach(DrawTool.allCases, id: \.self) { candidate in
                        Button {
                            tool = candidate
                        } label: {
                            VStack(spacing: 3) {
                                Image(systemName: candidate.icon)
                                    .font(.system(size: 18))
                                Text(candidate.rawValue)
                                    .font(.system(size: 10))
                            }
                            .frame(width: 62)
                            .padding(.vertical, Brand.Space.tight)
                            .foregroundStyle(tool == candidate ? Brand.blue : Brand.inkSoft)
                            .background(
                                tool == candidate ? Brand.blueLight : .clear,
                                in: .rect(cornerRadius: Brand.Radius.tile))
                        }
                        .buttonStyle(.plain)
                        .disabled(!candidate.isBuilt)
                        .opacity(candidate.isBuilt ? 1 : 0.35)
                    }
                }
                .padding(.horizontal, Brand.Space.base)
            }
        }
        .padding(.vertical, Brand.Space.small)
    }

    /// §2a's Adjustments mode: "a value dial at 0 and five channels".
    private var adjustControls: some View {
        VStack(spacing: Brand.Space.small) {
            // The dial's own readout, above it, reading 0 when untouched —
            // the reference's own arrangement.
            Text(valueLabel)
                .font(.system(size: 22, weight: .semibold).monospacedDigit())
                .foregroundStyle(Brand.ink)

            Slider(
                value: Binding(
                    get: { edit.adjustments[channel] },
                    set: { edit.adjustments[channel] = $0 }),
                in: -100...100,
                step: 1,
                onEditingChanged: { editing in
                    // One history entry per gesture, not per tick — the same
                    // rule the plan editor's drags follow.
                    if editing {
                        push()
                    } else {
                        rebuildPreview()
                    }
                }
            )
            .tint(Brand.blue)
            .padding(.horizontal, Brand.Space.base)
            .onChange(of: edit.adjustments[channel]) { _, _ in rebuildPreview() }

            HStack(spacing: Brand.Space.tight) {
                ForEach(Adjustments.Channel.allCases, id: \.self) { candidate in
                    Button {
                        channel = candidate
                    } label: {
                        Text(candidate.rawValue)
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Brand.Space.tight)
                            .foregroundStyle(channel == candidate ? Brand.blue : Brand.inkSoft)
                            .background(
                                channel == candidate ? Brand.blueLight : .clear,
                                in: .rect(cornerRadius: Brand.Radius.tile))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Brand.Space.small)
        }
        .padding(.vertical, Brand.Space.small)
    }

    private var valueLabel: String {
        let value = Int(edit.adjustments[channel].rounded())
        return value > 0 ? "+\(value)" : "\(value)"
    }

    /// §2a's bottom icon row — four modes, in their order, whether or not
    /// they do anything yet.
    private var modeRow: some View {
        HStack(spacing: 0) {
            ForEach(Mode.allCases, id: \.self) { candidate in
                Button {
                    mode = candidate
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: candidate.icon)
                            .font(.system(size: 20))
                        Text(candidate.label)
                            .font(.system(size: 11))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Brand.Space.small)
                    .foregroundStyle(mode == candidate ? Brand.blue : Brand.inkSoft)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(!candidate.isBuilt)
                .opacity(candidate.isBuilt ? 1 : 0.35)
            }
        }
        .background(Brand.surface)
    }

    // MARK: - History

    /// Snapshot BEFORE a change, the plan editor's own idiom.
    private func push() {
        history.append(edit)
        future.removeAll()
        if history.count > 40 { history.removeFirst() }
    }

    /// PencilKit finished a stroke and has already written it into `edit`.
    /// The snapshot that belongs on the stack is therefore the one WITHOUT
    /// that stroke, which is the last thing the canvas told us about.
    private func pushHistoryKeepingCurrent() {
        var previous = edit
        var strokes = previous.drawing.strokes
        guard !strokes.isEmpty else { return }
        strokes.removeLast()
        previous.drawing = PKDrawing(strokes: strokes)
        history.append(previous)
        future.removeAll()
        if history.count > 40 { history.removeFirst() }
    }

    private func undo() {
        guard let previous = history.popLast() else { return }
        future.append(edit)
        edit = previous
        rebuildPreview()
    }

    private func redo() {
        guard let next = future.popLast() else { return }
        history.append(edit)
        edit = next
        rebuildPreview()
    }

    // MARK: - Rendering

    private func prepare() {
        // The live preview runs on a downscaled copy. 1400px is well past
        // any phone screen and an eighth of the pixels of the stored photo,
        // which is the difference between a slider that tracks the finger
        // and one that stutters.
        previewBase = original.resized(maxEdge: 1400)
        rebuildPreview()
    }

    /// Redraw the on-screen preview from the current edit.
    ///
    /// The SAME pipeline renders what gets uploaded — `Self.rendered` — so
    /// the operator cannot be shown one edit and file another. Only the
    /// resolution differs, and the redaction rects are scaled with it.
    private func rebuildPreview() {
        guard let base = previewBase else { return }
        let ratio = original.size.width > 0 ? base.size.width / original.size.width : 1
        preview = Self.rendered(
            base,
            adjustments: edit.adjustments,
            regions: edit.redactions.map { rect in
                CGRect(
                    x: rect.minX * ratio, y: rect.minY * ratio,
                    width: rect.width * ratio, height: rect.height * ratio)
            },
            // The drawing is composited at Done, not here: PencilKit is
            // already on screen over the picture, drawing itself.
            drawing: nil)
    }

    private func commit() async {
        saving = true
        error = nil
        defer { saving = false }

        guard
            let flat = Self.rendered(
                original, adjustments: edit.adjustments, regions: edit.redactions,
                drawing: edit.drawing.strokes.isEmpty ? nil : edit.drawing,
                annotations: edit.shapes.isEmpty
                    ? nil
                    : Self.annotationImage(
                        edit.shapes,
                        size: Self.outputSize(
                            of: original, quarterTurns: edit.quarterTurns, crop: edit.crop)),
                quarterTurns: edit.quarterTurns, flipped: edit.flipped,
                straighten: edit.straighten, crop: edit.crop,
                drawnAt: drawnSize),
            let jpeg = flat.jpegData(compressionQuality: 0.85)
        else {
            error = "Could not render the edited photo."
            return
        }

        do {
            // Upload FIRST. If this fails there is still exactly one photo,
            // the original, and the operator can try again. Deleting first
            // would risk having neither.
            _ = try await API.shared.uploadPhoto(
                projectId: projectId, roomScanId: roomScanId, affectedAreaId: affectedAreaId,
                wallIndex: wallIndex, jpeg: jpeg, note: replacing.note)
            // Only now is the original worth removing — and where this was a
            // redaction it MUST be removed, or the blur was decoration.
            try await API.shared.deletePhoto(id: replacing.id)
            onFinished()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Geometry and pixels

    /// What a `scaledToFit` image actually occupies inside a container.
    ///
    /// Shared by the gesture and the overlay so the two agree by
    /// construction. `FloorPlanView` taught this the expensive way: a view
    /// that constrains its own size does not fill what it was offered, and
    /// an overlay positioned in the offer sits wrong by the difference.
    static func fitted(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return .zero }
        let scale = min(container.width / image.width, container.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(
            x: (container.width - size.width) / 2,
            y: (container.height - size.height) / 2,
            width: size.width, height: size.height)
    }

    /// Two screen points → one rect in the IMAGE's own pixels.
    ///
    /// Clamped to the image, because a finger that runs off the edge of the
    /// picture means "to the edge", not "past it" — and a region outside the
    /// bitmap silently redacts nothing.
    static func rect(from a: CGPoint, to b: CGPoint, image: CGSize, drawn: CGRect) -> CGRect {
        guard drawn.width > 0, drawn.height > 0 else { return .zero }
        let scale = image.width / drawn.width
        let x0 = min(a.x, b.x) * scale
        let x1 = max(a.x, b.x) * scale
        let y0 = min(a.y, b.y) * scale
        let y1 = max(a.y, b.y) * scale
        let clamped = CGRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0)
            .intersection(CGRect(origin: .zero, size: image))
        return clamped.isNull ? .zero : clamped
    }

    /// What the finished file will measure, which the annotation overlay
    /// has to match. Only the crop and the quarter turns change it; a
    /// straighten grows the frame slightly and is close enough at this
    /// scale not to be worth a second pass.
    @MainActor
    static func outputSize(of image: UIImage, quarterTurns: Int, crop: CGRect?) -> CGSize {
        let base = crop?.size ?? image.size
        return quarterTurns % 2 == 0 ? base : CGSize(width: base.height, height: base.width)
    }

    /// The shapes as a transparent image, drawn through the same routine
    /// the screen uses.
    @MainActor
    static func annotationImage(_ shapes: [Annotation], size: CGSize) -> UIImage? {
        guard size.width > 0, size.height > 0 else { return nil }
        let renderer = ImageRenderer(
            content:
                Canvas { context, _ in
                    for shape in shapes {
                        drawShape(shape, in: context, scale: 1, size: size)
                    }
                }
                .frame(width: size.width, height: size.height)
        )
        renderer.scale = 1
        return renderer.uiImage
    }

    /// One screen point → the image's own pixels.
    ///
    /// The counterpart of `toScreen`, and the reason both exist here rather
    /// than at their call sites: every mark this editor makes is stored in
    /// image pixels, so exactly one conversion each way is what keeps the
    /// preview and the saved file the same drawing.
    static func imagePoint(_ p: CGPoint, image: CGSize, drawn: CGRect) -> CGPoint {
        guard drawn.width > 0 else { return .zero }
        let scale = image.width / drawn.width
        return CGPoint(x: p.x * scale, y: p.y * scale)
    }

    /// One annotation, drawn at whatever scale it is asked for.
    ///
    /// `scale` converts image pixels to the destination — the drawn size on
    /// screen for the live overlay, 1 for the full-resolution render — so
    /// the SAME routine does both and a mark cannot look one way on screen
    /// and another in the file.
    static func drawShape(
        _ shape: Annotation, in context: GraphicsContext, scale: CGFloat, size: CGSize
    ) {
        let a = CGPoint(x: shape.a.x * scale, y: shape.a.y * scale)
        let b = CGPoint(x: shape.b.x * scale, y: shape.b.y * scale)
        let width = max(1, shape.width * scale)
        let box = CGRect(
            x: min(a.x, b.x), y: min(a.y, b.y),
            width: abs(b.x - a.x), height: abs(b.y - a.y))

        switch shape.kind {
        case .line:
            var path = Path()
            path.move(to: a)
            path.addLine(to: b)
            context.stroke(
                path, with: .color(shape.color),
                style: StrokeStyle(lineWidth: width, lineCap: .round))

        case .arrow:
            var path = Path()
            path.move(to: a)
            path.addLine(to: b)
            context.stroke(
                path, with: .color(shape.color),
                style: StrokeStyle(lineWidth: width, lineCap: .round))
            // The head, scaled to the LINE's weight rather than its length:
            // a long thin arrow and a short thin one should point the same
            // way with the same nib.
            let angle = atan2(b.y - a.y, b.x - a.x)
            let head = max(width * 3.5, 10)
            var tip = Path()
            tip.move(to: b)
            tip.addLine(
                to: CGPoint(
                    x: b.x - cos(angle - .pi / 7) * head,
                    y: b.y - sin(angle - .pi / 7) * head))
            tip.addLine(
                to: CGPoint(
                    x: b.x - cos(angle + .pi / 7) * head,
                    y: b.y - sin(angle + .pi / 7) * head))
            tip.closeSubpath()
            context.fill(tip, with: .color(shape.color))

        case .rectangle:
            context.stroke(
                Path(box), with: .color(shape.color), style: StrokeStyle(lineWidth: width))

        case .ellipse:
            context.stroke(
                Path(ellipseIn: box), with: .color(shape.color),
                style: StrokeStyle(lineWidth: width))

        case .text:
            guard !shape.text.isEmpty else { return }
            // Sized to the box the operator dragged out, so text scales the
            // way the shape tools do rather than being one fixed size on a
            // photo that might be 500px or 4000px across.
            let point = max(12, min(box.height, width * 6))
            let resolved = context.resolve(
                Text(shape.text)
                    .font(.system(size: point, weight: .semibold))
                    .foregroundStyle(shape.color))
            context.draw(resolved, at: CGPoint(x: box.minX, y: box.minY), anchor: .topLeading)

        default:
            break
        }
    }

    /// One image-pixel rect back to the drawn image's own coordinates.
    static func toScreen(_ rect: CGRect, image: CGSize, drawn: CGRect) -> CGRect {
        guard image.width > 0 else { return .zero }
        let scale = drawn.width / image.width
        return CGRect(
            x: rect.minX * scale, y: rect.minY * scale,
            width: rect.width * scale, height: rect.height * scale)
    }

    /// The whole pipeline: adjust, redact, then draw over the top.
    ///
    /// **That order is deliberate.** Adjustments are a property of the
    /// photograph, so they come first and the redaction pixellates what the
    /// operator can actually see. Annotation comes LAST, so an arrow drawn
    /// pointing at a blurred plate stays crisp instead of being pixellated
    /// along with it.
    ///
    /// Returns nil rather than the original on failure — a caller that
    /// cannot tell "edited" from "unchanged" is how an unredacted photo gets
    /// uploaded as a redacted one.
    static func rendered(
        _ image: UIImage, adjustments: Adjustments, regions: [CGRect], drawing: PKDrawing?,
        /// The shape tools' marks, already rendered to a transparent image
        /// the size of the photograph, composited last so an arrow drawn at
        /// a blurred plate stays crisp.
        ///
        /// An IMAGE rather than the shapes themselves, for a reason worth
        /// keeping: `drawShape` draws into a SwiftUI `GraphicsContext` and
        /// there is no way to construct one over a `CGContext`. Rendering
        /// the overlay through a `Canvas` keeps ONE drawing routine serving
        /// both the live preview and the saved file, where a Core Graphics
        /// twin would be a second copy to keep in step — and this file
        /// already knows what that costs.
        annotations: UIImage? = nil,
        /// Crop and transform. Applied FIRST, before anything is drawn on
        /// the photograph — a mark is placed on the picture the operator
        /// can see, and rotating afterwards would carry it somewhere else.
        quarterTurns: Int = 0, flipped: Bool = false, straighten: Double = 0,
        crop: CGRect? = nil,
        /// The size the drawing was made at — the picture's own drawn size
        /// on screen. The strokes are in THAT space, and the photograph is
        /// in pixels; the ratio between them is the whole reason this is a
        /// parameter rather than an assumption.
        drawnAt canvasSize: CGSize = .zero
    ) -> UIImage? {
        guard let cgImage = image.cgImage else { return nil }

        let context = CIContext()
        var working = CIImage(cgImage: cgImage)

        // **Geometry first.** Crop, rotation and flip change what the
        // picture IS; everything after them — adjustments, redactions,
        // annotation — is applied to the picture the operator was looking
        // at when they made the mark. In the other order a redaction would
        // travel somewhere else the moment the photo was straightened.
        if let crop {
            // UIKit's rect is top-left; Core Image's is bottom-left.
            let flippedRect = CGRect(
                x: crop.minX, y: working.extent.height - crop.maxY,
                width: crop.width, height: crop.height)
            working = working.cropped(to: flippedRect)
            working = working.transformed(
                by: CGAffineTransform(
                    translationX: -working.extent.minX, y: -working.extent.minY))
        }
        if flipped {
            working = working.transformed(by: CGAffineTransform(scaleX: -1, y: 1))
            working = working.transformed(
                by: CGAffineTransform(translationX: working.extent.width, y: 0))
        }
        if straighten != 0 || quarterTurns != 0 {
            let radians = -straighten * .pi / 180 + Double(quarterTurns) * .pi / 2
            let rotated = working.transformed(by: CGAffineTransform(rotationAngle: radians))
            working = rotated.transformed(
                by: CGAffineTransform(
                    translationX: -rotated.extent.minX, y: -rotated.extent.minY))
        }

        let extent = working.extent

        // §2a's five channels, each mapped from the dial's −100…100 to its
        // filter's own units. Skipped entirely when untouched, so an
        // unadjusted photo is not re-encoded through three filters for
        // nothing.
        if !adjustments.isIdentity {
            let colour = CIFilter.colorControls()
            colour.inputImage = working
            // Neutrals are the filter's own defaults: 0, 1 and 1.
            colour.brightness = Float(adjustments.brightness / 250)
            colour.contrast = Float(1 + adjustments.contrast / 200)
            colour.saturation = Float(1 + adjustments.saturation / 100)
            working = colour.outputImage ?? working

            if adjustments.exposure != 0 {
                let exposure = CIFilter.exposureAdjust()
                exposure.inputImage = working
                // Stops. Two either way is the range a phone photo of a dim
                // basement actually needs.
                exposure.ev = Float(adjustments.exposure / 50)
                working = exposure.outputImage ?? working
            }

            if adjustments.temperature != 0 {
                let temp = CIFilter.temperatureAndTint()
                temp.inputImage = working
                // Told the image is lit at one temperature, the filter
                // rebalances it to 6500K — so moving the source DOWN warms
                // the result. 6500 ± 2500K covers tungsten to overcast.
                temp.neutral = CIVector(x: 6500 - adjustments.temperature * 25, y: 0)
                temp.targetNeutral = CIVector(x: 6500, y: 0)
                working = temp.outputImage ?? working
            }
        }

        // The redaction. **Pixellate rather than blur, and the difference
        // matters.** A Gaussian blur preserves the low frequencies, and text
        // under a light blur has repeatedly been read back out by
        // deconvolution. Pixellation at a coarse cell throws the information
        // away instead. The reference calls this mode "Pixelate / blur";
        // where the two disagree, the one that actually destroys the pixels
        // is the one a claim photo needs.
        //
        // The cell is scaled to the REGION, not fixed: a 40pt cell over a
        // licence plate in a 4000px photo leaves the plate perfectly
        // readable. An eighth of the region's short side, floored at 12px,
        // keeps the redaction destructive at any size.
        for region in regions {
            // Core Image's origin is bottom-left; UIKit's is top-left, and
            // the rects arrived in UIKit's. Flipping here rather than at
            // every use keeps one conversion in one place.
            let flipped = CGRect(
                x: region.minX, y: extent.height - region.maxY,
                width: region.width, height: region.height)
            guard flipped.width > 1, flipped.height > 1 else { continue }

            let filter = CIFilter.pixellate()
            filter.inputImage = working
            filter.scale = Float(max(12, min(flipped.width, flipped.height) / 8))
            filter.center = CGPoint(x: flipped.midX, y: flipped.midY)
            guard let pixelated = filter.outputImage else { continue }

            // `CIPixellate` returns an image the size of the whole picture;
            // cropping it to the region is what confines the effect, and
            // compositing that over the running output is what lets several
            // redactions stack without each one undoing the last.
            working = pixelated.cropped(to: flipped).composited(over: working)
        }

        guard let rendered = context.createCGImage(working, from: extent) else { return nil }
        let flat = UIImage(cgImage: rendered, scale: 1, orientation: image.imageOrientation)

        let hasDrawing = (drawing?.strokes.isEmpty == false) && canvasSize.width > 0
        guard hasDrawing || annotations != nil else { return flat }

        // The annotation, drawn over the finished photograph at the photo's
        // own resolution. PencilKit's strokes are in the canvas's points —
        // the picture's DRAWN size — so rendering the drawing into a canvas
        // the size of the picture and scaling by the ratio puts every stroke
        // exactly where it sat under the finger.
        let size = CGSize(width: extent.width, height: extent.height)
        let ratio = canvasSize.width > 0 ? size.width / canvasSize.width : 1
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            flat.draw(in: CGRect(origin: .zero, size: size))

            annotations?.draw(in: CGRect(origin: .zero, size: size))
            // Rendered at `ratio` so a stroke drawn 11pt wide on screen is
            // 11pt wide RELATIVE TO THE PICTURE in the file, not 11 pixels
            // of a 2048px image. Drawing the stroke image into a scaled
            // rect would soften it; asking PencilKit to render at the scale
            // keeps the line crisp at full resolution.
            guard let drawing, hasDrawing else { return }
            let bounds = drawing.bounds
            let target = CGRect(
                x: bounds.minX * ratio, y: bounds.minY * ratio,
                width: bounds.width * ratio, height: bounds.height * ratio)
            drawing.image(from: bounds, scale: ratio).draw(in: target)
        }
    }
}

// MARK: - PencilKit, on the picture

/// `PKCanvasView` over the photo, sized to the photo's drawn rect.
///
/// PencilKit rather than a hand-rolled stroke, which is §2a's own
/// recommendation and right: it brings pressure, smoothing and a line that
/// does not look hand-rolled, and a freehand mark drawn by hand on a phone
/// always does.
///
/// It is transparent and stops taking touches outside Draw mode, or it would
/// swallow the redaction drag underneath it.
struct DrawingCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    let tool: PhotoEditorView.DrawTool
    let ink: Color
    let width: PhotoEditorView.LineWidth
    let isActive: Bool
    let onStrokeFinished: () -> Void

    func makeUIView(context: Context) -> PKCanvasView {
        let view = PKCanvasView()
        view.backgroundColor = .clear
        view.isOpaque = false
        // Finger as well as pencil: this is a phone on a job site, and the
        // operator is not carrying an Apple Pencil into a flooded basement.
        view.drawingPolicy = .anyInput
        view.delegate = context.coordinator
        view.drawing = drawing
        return view
    }

    func updateUIView(_ view: PKCanvasView, context: Context) {
        view.isUserInteractionEnabled = isActive
        view.tool = currentTool

        // Only when it actually differs — undo and redo put a previous
        // drawing back, and writing the canvas's own drawing back into it on
        // every render would fight the stroke in progress.
        if view.drawing.dataRepresentation() != drawing.dataRepresentation() {
            context.coordinator.isApplyingExternalChange = true
            view.drawing = drawing
            context.coordinator.isApplyingExternalChange = false
        }
    }

    private var currentTool: PKTool {
        switch tool {
        case .eraser:
            return PKEraserTool(.bitmap, width: width.points)
        default:
            return PKInkingTool(.marker, color: UIColor(ink), width: width.points)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        private let parent: DrawingCanvas
        /// True while `updateUIView` is pushing an undo back into the
        /// canvas, so the delegate callback it provokes is not mistaken for
        /// the operator drawing something.
        var isApplyingExternalChange = false

        init(_ parent: DrawingCanvas) { self.parent = parent }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            guard !isApplyingExternalChange else { return }
            let new = canvasView.drawing
            guard new.dataRepresentation() != parent.drawing.dataRepresentation() else { return }
            parent.drawing = new
            parent.onStrokeFinished()
        }
    }
}

// MARK: - The viewer the editor is reached from

/// One photo, full screen, with `Edit`.
///
/// §2a reaches the editor from the photo viewer's `Edit`, and until now this
/// app had no viewer at all — the thumbnails in `RoomPhotosSection` were not
/// even tappable, so a photo could be uploaded and then never looked at on
/// the phone that took it.
struct PhotoViewer: View {
    let photo: RoomPhoto
    let projectId: String
    let roomScanId: String?
    let affectedAreaId: String?
    let wallIndex: Int?
    /// Called when an edit replaced this photo, so the grid behind can
    /// reload — the id it was drawing no longer exists.
    let onReplaced: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var loaded: UIImage?
    @State private var editing = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let loaded {
                    Image(uiImage: loaded)
                        .resizable()
                        .scaledToFit()
                } else {
                    ProgressView().tint(.white)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Edit") { editing = true }
                        .disabled(loaded == nil)
                }
            }
            .task { await load() }
            .fullScreenCover(isPresented: $editing) {
                if let loaded {
                    PhotoEditorView(
                        original: loaded,
                        projectId: projectId,
                        roomScanId: roomScanId,
                        affectedAreaId: affectedAreaId,
                        wallIndex: wallIndex,
                        replacing: photo,
                        onFinished: {
                            onReplaced()
                            dismiss()
                        })
                }
            }
        }
    }

    /// Fetched at full stored resolution rather than reusing the grid's
    /// thumbnail: an editor that redacts a 96pt copy would upload a 96pt
    /// photo over a 2048px one.
    private func load() async {
        guard let url = photo.url.flatMap(URL.init) else { return }
        if let (data, _) = try? await URLSession.shared.data(from: url) {
            loaded = UIImage(data: data)
        }
    }
}
