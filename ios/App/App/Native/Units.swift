import Foundation

/// How a length is written down.
///
/// The Swift twin of `src/lib/units.ts` — same presets, same rounding, same
/// output. The geometry in this repo is deliberately duplicated in two
/// languages, and a length that reads one way on the phone and another in the
/// PDF is the same wall described twice; an adjuster reading both will ask
/// which one is real. If you change one of these files, change the other.
///
/// Storage is always metres. This is the only place that turns one into text.
struct LengthFormat: Equatable, Codable {

    enum System: String, Codable, CaseIterable, Identifiable {
        case metric, feet, inches
        var id: String { rawValue }

        var title: String {
            switch self {
            case .metric: return "Metric"
            case .feet: return "Feet"
            case .inches: return "Inches"
            }
        }
    }

    enum MetricUnit: String, Codable { case m, cm }

    /// Two legitimate ways to write feet and inches, and this app needs both.
    ///
    /// `drafting` is `17'-1"` — hyphenated, whole feet keeping their `-0"`.
    /// That belongs on the dimension line of an architectural drawing, and it
    /// is what the plan has always drawn.
    ///
    /// `plain` is `17' 1"`, whole feet just `17'`. That is how a measurement
    /// reads in a field, a list row, or a sentence.
    ///
    /// Both already existed here as separate functions that had quietly
    /// drifted apart. Naming them stops a third from appearing.
    enum ImperialStyle: String, Codable { case drafting, plain }

    var system: System
    var metricUnit: MetricUnit = .m
    var decimals: Int = 3
    /// 1 means whole inches, 2 halves, 4 quarters.
    var denominator: Int = 1
    var style: ImperialStyle = .plain

    // MARK: - Presets

    /// Feet and whole inches. What this trade quotes in.
    static let `default` = LengthFormat(system: .feet, denominator: 1)

    /// The rows the units picker offers, per system, in the order shown.
    static func presets(for system: System) -> [LengthFormat] {
        switch system {
        case .metric:
            return [
                LengthFormat(system: .metric, metricUnit: .m, decimals: 2),
                LengthFormat(system: .metric, metricUnit: .m, decimals: 3),
                LengthFormat(system: .metric, metricUnit: .cm, decimals: 0),
                LengthFormat(system: .metric, metricUnit: .cm, decimals: 1),
            ]
        case .feet:
            return [1, 2, 4].map { LengthFormat(system: .feet, denominator: $0) }
        case .inches:
            return [1, 2, 4].map { LengthFormat(system: .inches, denominator: $0) }
        }
    }

    /// The sample a picker row shows.
    ///
    /// Metric rows all show the same 2.5 m, so the rows differ only in
    /// precision. Imperial rows cannot do that — a whole number formatted to
    /// quarters is still a whole number, and three identical rows teach
    /// nothing — so each shows a length carrying the fraction it can express.
    var sample: String {
        switch system {
        case .metric:
            return format(2.5)
        case .feet, .inches:
            let inches = 18.0 + (denominator > 1 ? 1.0 / Double(denominator) : 0)
            return format(inches * Self.inchesToMetres)
        }
    }

    // MARK: - Writing

    static let inchesToMetres = 0.0254
    static let feetToMetres = 0.3048

    func format(_ metres: Double) -> String {
        guard metres.isFinite else { return "—" }
        let negative = metres < 0
        let body = writeBody(abs(metres))
        return negative ? "-\(body)" : body
    }

    private func writeBody(_ metres: Double) -> String {
        switch system {
        case .metric:
            let value = metricUnit == .cm ? metres * 100 : metres
            return String(format: "%.\(decimals)f %@", value, metricUnit.rawValue)
        case .feet, .inches:
            return writeImperial(metres)
        }
    }

    private func writeImperial(_ metres: Double) -> String {
        let d = max(1, denominator)

        // Round to the fraction first, in ticks of 1/d inch, so everything
        // below is integer arithmetic and no carry is lost to a float.
        let ticks = Int((metres / Self.inchesToMetres * Double(d)).rounded())
        let wholeInches = ticks / d
        let remainder = ticks % d
        let fraction = Self.fractionText(remainder, d)

        if system == .inches {
            return fraction.isEmpty ? "\(wholeInches)\"" : "\(wholeInches) \(fraction)\""
        }

        let feet = wholeInches / 12
        let inches = wholeInches % 12
        let inchPart = fraction.isEmpty ? "\(inches)\"" : "\(inches) \(fraction)\""

        // Under a foot reads as inches alone; `0' 8"` is how a form prints,
        // not how anyone writes on a plan.
        if feet == 0 { return inchPart }

        // The drafting style keeps its -0" on whole feet: a dimension line
        // reading `17'` is ambiguous about whether the inches were measured.
        if style == .drafting { return "\(feet)'-\(inchPart)" }

        if inches == 0 && fraction.isEmpty { return "\(feet)'" }
        return "\(feet)' \(inchPart)"
    }

    /// The fractional part, reduced. Empty when there is none.
    ///
    /// Note the notation: `1' 6 1/2"`, with one inch mark at the end. The
    /// reference app writes `1' 6" 1/2"`, with two — that is malformed, and
    /// this text reaches documents an insurer reads, so it is written
    /// correctly here rather than copied.
    private static func fractionText(_ remainder: Int, _ denominator: Int) -> String {
        guard remainder != 0 else { return "" }
        let divisor = gcd(remainder, denominator)
        return "\(remainder / divisor)/\(denominator / divisor)"
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int {
        b == 0 ? a : gcd(b, a % b)
    }

    // MARK: - Reading

    /// Read a length a human typed, in METRES.
    ///
    /// Deliberately permissive: this is typed one-thumbed on a phone in a
    /// basement. Understands the imperial shapes a contractor writes — 12,
    /// 12.5, 12'6, 12' 6", 12ft 6in, 12-6, and fractions like 12' 6 1/2" —
    /// plus explicit metric when a unit is given: 3.81m, 381cm, 3810mm.
    ///
    /// A bare number means whatever system is in force. A typed unit always
    /// wins over that, because a typed unit is a statement rather than a
    /// preference.
    func parse(_ input: String) -> Double? {
        Self.parse(input, assuming: system)
    }

    static func parse(_ input: String, assuming system: System) -> Double? {
        let text = input.trimmingCharacters(in: .whitespaces).lowercased()
        guard !text.isEmpty else { return nil }

        if let metric = parseMetric(text) { return metric }
        if let imperial = parseImperial(text) { return imperial }

        guard let bare = Double(text.replacingOccurrences(of: ",", with: ".")) else { return nil }
        switch system {
        case .metric: return bare
        case .inches: return bare * inchesToMetres
        case .feet: return bare * feetToMetres
        }
    }

    private static func parseMetric(_ text: String) -> Double? {
        for (suffix, scale) in [("mm", 0.001), ("cm", 0.01), ("m", 1.0)] {
            guard text.hasSuffix(suffix) else { continue }
            let head = text.dropLast(suffix.count).trimmingCharacters(in: .whitespaces)
            // "m" also ends "cm" and "mm"; those are matched first, so a bare
            // trailing "m" here is genuinely metres. An empty head is not a
            // number — Double("") is nil, which is the behaviour wanted.
            if let value = Double(head.replacingOccurrences(of: ",", with: ".")) {
                return value * scale
            }
        }
        return nil
    }

    /// The imperial shapes, in metres, or nil if this is not one.
    ///
    /// Hand-scanned rather than regex'd: there are five shapes and the
    /// alternation that covered them all was unreadable.
    private static func parseImperial(_ text: String) -> Double? {
        // Requires at least one imperial marker, otherwise a bare number
        // would be claimed here instead of falling through to the caller.
        let markers: Set<Character> = ["'", "\u{2019}", "\"", "\u{201D}", "/", "-"]
        let hasWord = text.contains("ft") || text.contains("feet") || text.contains("in")
        guard text.contains(where: { markers.contains($0) }) || hasWord else { return nil }

        var feet = 0.0
        var inches = 0.0
        var negative = false
        var rest = Substring(text)

        // Feet, if a foot marker is present.
        if let cut = rest.firstIndex(where: { $0 == "'" || $0 == "\u{2019}" }) {
            guard let value = Double(rest[rest.startIndex..<cut].trimmingCharacters(in: .whitespaces))
            else { return nil }
            negative = value < 0
            feet = abs(value)
            rest = rest[rest.index(after: cut)...]
        } else if let range = rest.range(of: "ft") ?? rest.range(of: "feet") {
            guard let value = Double(rest[rest.startIndex..<range.lowerBound]
                .trimmingCharacters(in: .whitespaces))
            else { return nil }
            negative = value < 0
            feet = abs(value)
            rest = rest[range.upperBound...]
        } else if let dash = rest.dropFirst().firstIndex(of: "-"),
                  rest.contains(where: \.isNumber) {
            // The dashed form: 12-6 is twelve feet six inches.
            guard let value = Double(rest[rest.startIndex..<dash].trimmingCharacters(in: .whitespaces)),
                  let after = Double(rest[rest.index(after: dash)...].trimmingCharacters(in: .whitespaces))
            else { return nil }
            negative = value < 0
            let total = abs(value) + after / 12
            return (negative ? -total : total) * feetToMetres
        }

        // Whatever is left is inches, possibly with a fraction.
        var tail = rest
            .replacingOccurrences(of: "inches", with: "")
            .replacingOccurrences(of: "inch", with: "")
            .replacingOccurrences(of: "in", with: "")
            .replacingOccurrences(of: "\"", with: "")
            .replacingOccurrences(of: "\u{201D}", with: "")
            .trimmingCharacters(in: .whitespaces)

        if let slash = tail.firstIndex(of: "/") {
            // Everything before the slash splits into whole inches and a
            // numerator; `6 1/2` and `1/2` are both legal here.
            let head = tail[tail.startIndex..<slash].trimmingCharacters(in: .whitespaces)
            let denominatorText = tail[tail.index(after: slash)...].trimmingCharacters(in: .whitespaces)
            guard let denominator = Double(denominatorText), denominator != 0 else { return nil }

            let parts = head.split(separator: " ")
            guard let numerator = parts.last.flatMap({ Double($0) }) else { return nil }
            if parts.count > 1, let whole = Double(parts[0]) { inches += whole }
            inches += numerator / denominator
            tail = ""
        }

        if !tail.isEmpty {
            guard let value = Double(tail) else { return nil }
            inches += value
        }

        guard feet != 0 || inches != 0 else { return nil }
        let total = feet + inches / 12
        return (negative ? -total : total) * feetToMetres
    }
}
