import Foundation

/// Display conversion. Storage is always metres (§1); imperial exists only
/// on the way to the screen or the page.
public enum Units {
    public static let metersPerFoot = 0.3048
    /// Square feet in one square metre: 1 / 0.3048², exactly as defined.
    public static let squareFeetPerSquareMeter = 1 / (metersPerFoot * metersPerFoot)

    public static func feet(_ m: Meters) -> Double { m / metersPerFoot }
    public static func squareFeet(_ m2: Double) -> Double { m2 * squareFeetPerSquareMeter }

    /// "11 ft 4.1 in" — feet and tenths of an inch (T14). Rounding is done on
    /// the inches, and 12.0 in carries into the next foot rather than printing
    /// "10 ft 12.0 in".
    public static func feetInches(_ m: Meters) -> String {
        let totalInches = (feet(abs(m)) * 12 * 10).rounded() / 10
        var ft = Int(totalInches / 12)
        var inches = totalInches - Double(ft) * 12
        if inches >= 11.95 {
            ft += 1
            inches = 0
        }
        let sign = m < 0 ? "-" : ""
        return "\(sign)\(ft) ft \(String(format: "%.1f", inches)) in"
    }

    /// "129.17 ft²" / "12.00 m²".
    public static func area(_ m2: Double, in system: UnitSystem) -> String {
        switch system {
        case .metric: return String(format: "%.2f m²", m2)
        case .imperial: return String(format: "%.2f ft²", squareFeet(m2))
        }
    }
}
