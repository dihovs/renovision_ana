import Combine
import CoreBluetooth
import FloorPlanCore
import Foundation

/// Bluetooth laser meters (floor-plan spec §13, M9).
///
/// One `LaserMeterDriver` per maker: which Bluetooth service to scan for,
/// which characteristic notifies with a measurement, and how its bytes
/// become metres (`LaserPayload`, tested in FloorPlanCore). The manager does
/// the CoreBluetooth part once for all of them, and hands every believable
/// reading to whoever is listening — the plan editor puts it on a wall.
protocol LaserMeterDriver {
    var name: String { get }
    var service: CBUUID { get }
    /// Every characteristic that may carry a measurement on this maker's
    /// meters — subscribed to all, since models differ.
    var measurements: [CBUUID] { get }
    var payload: LaserPayload { get }
    /// False until the GATT details have been confirmed on a real meter.
    /// Shown in the UI so a wrong driver reads as "unverified", not broken.
    var verified: Bool { get }
}

/// **Leica DISTO** (D1/D2/D110/X-series), UNVERIFIED.
///
/// Leica publishes no Bluetooth protocol. These UUIDs come from community
/// reverse-engineering, checked 4 Nov 2026: service `3ab10100-…` is Leica's
/// own across models; `3ab10101-…` carries the measurement on the D2-era
/// meters (seichter/d2relay, MIT), `3ab1010d-…` the "basic measurement" on
/// newer ones (a Leica SDK log shows it decoding to distance 0.666452).
/// Both start with the distance as a little-endian Float32 in metres — an
/// inference from that log, not a published fact. Confirm on his meter
/// before trusting a number from it; `Laser.validated` already refuses
/// anything that is not a believable distance.
struct LeicaDistoDriver: LaserMeterDriver {
    let name = "Leica DISTO"
    let service = CBUUID(string: "3AB10100-F831-4395-B29D-570977D5BF94")
    let measurements = [
        CBUUID(string: "3AB10101-F831-4395-B29D-570977D5BF94"),
        CBUUID(string: "3AB1010D-F831-4395-B29D-570977D5BF94"),
    ]
    let payload = LaserPayload.float32Meters(offset: 0)
    let verified = false
}

@MainActor
final class LaserMeterManager: NSObject, ObservableObject {
    static let shared = LaserMeterManager()

    /// Bosch's GLM protocol has been reverse-engineered by hobbyists but not
    /// published in enough detail to verify; it is left out rather than
    /// guessed. Adding a maker is one more struct here.
    let drivers: [LaserMeterDriver] = [LeicaDistoDriver()]

    enum Status: Equatable {
        case off, unauthorized, unsupported, idle, scanning
        case connecting(String)
        case connected(String)
    }

    struct Found: Identifiable {
        let id: UUID
        let name: String
        let rssi: Int
        let driver: String
    }

    @Published private(set) var status: Status = .idle
    @Published private(set) var found: [Found] = []
    /// Every believable reading, from a meter or from the simulator.
    let readings = PassthroughSubject<LaserReading, Never>()

    private var central: CBCentralManager?
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var driverFor: [UUID: LaserMeterDriver] = [:]
    private var connected: CBPeripheral?
    private static let rememberedKey = "laser.peripheral"

    /// Bluetooth is only switched on when he opens the laser panel: the
    /// permission prompt belongs to the moment the answer means something.
    func start() {
        if central == nil {
            central = CBCentralManager(delegate: self, queue: .main)
        } else {
            scan()
        }
    }

    func stop() {
        central?.stopScan()
        if case .scanning = status { status = .idle }
    }

    func connect(_ id: UUID) {
        guard let central, let p = peripherals[id] else { return }
        central.stopScan()
        status = .connecting(p.name ?? "Laser")
        p.delegate = self
        central.connect(p)
    }

    func disconnect() {
        if let p = connected { central?.cancelPeripheralConnection(p) }
        UserDefaults.standard.removeObject(forKey: Self.rememberedKey)
        connected = nil
        status = .idle
    }

    /// A reading with no meter at all (§13 "Simulator driver"): for trying
    /// the flow, and for tests.
    func simulate(meters: Double) {
        guard let m = Laser.validated(meters) else { return }
        readings.send(LaserReading(meters: m, deviceID: "simulator"))
    }

    private func scan() {
        guard let central, central.state == .poweredOn else { return }
        // Reconnect to the meter he used last, if it is about.
        if let s = UserDefaults.standard.string(forKey: Self.rememberedKey), let id = UUID(uuidString: s),
            let p = central.retrievePeripherals(withIdentifiers: [id]).first
        {
            peripherals[id] = p
            if let d = drivers.first { driverFor[id] = d }
            connect(id)
            return
        }
        found = []
        status = .scanning
        central.scanForPeripherals(withServices: drivers.map(\.service))
    }
}

extension LaserMeterManager: CBCentralManagerDelegate, CBPeripheralDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let state = central.state
        Task { @MainActor in
            switch state {
            case .poweredOn: self.scan()
            case .poweredOff: self.status = .off
            case .unauthorized: self.status = .unauthorized
            case .unsupported: self.status = .unsupported
            default: break
            }
        }
    }

    nonisolated func centralManager(
        _ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any], rssi RSSI: NSNumber
    ) {
        let services = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]) ?? []
        let id = peripheral.identifier
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? "Laser meter"
        let rssi = RSSI.intValue
        Task { @MainActor in
            guard let driver = self.drivers.first(where: { services.contains($0.service) }) ?? self.drivers.first
            else { return }
            self.peripherals[id] = peripheral
            self.driverFor[id] = driver
            self.found.removeAll { $0.id == id }
            self.found.append(Found(id: id, name: name, rssi: rssi, driver: driver.name))
            // Strongest signal first — the meter in his hand, not the van's.
            self.found.sort { $0.rssi > $1.rssi }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            self.connected = peripheral
            UserDefaults.standard.set(peripheral.identifier.uuidString, forKey: Self.rememberedKey)
            self.status = .connected(peripheral.name ?? "Laser meter")
            peripheral.discoverServices(self.drivers.map(\.service))
        }
    }

    nonisolated func centralManager(
        _ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?
    ) {
        Task { @MainActor in
            self.connected = nil
            self.status = .idle
        }
    }

    nonisolated func centralManager(
        _ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?
    ) {
        Task { @MainActor in self.status = .idle }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        for service in peripheral.services ?? [] { peripheral.discoverCharacteristics(nil, for: service) }
    }

    nonisolated func peripheral(
        _ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?
    ) {
        let id = peripheral.identifier
        let chars = service.characteristics ?? []
        Task { @MainActor in
            guard let driver = self.driverFor[id] ?? self.drivers.first else { return }
            for c in chars where driver.measurements.contains(c.uuid) {
                peripheral.setNotifyValue(true, for: c)
            }
        }
    }

    nonisolated func peripheral(
        _ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?
    ) {
        guard let data = characteristic.value else { return }
        let bytes = [UInt8](data)
        let id = peripheral.identifier
        Task { @MainActor in
            guard let driver = self.driverFor[id] ?? self.drivers.first,
                let m = driver.payload.meters(from: bytes)
            else { return }
            self.readings.send(LaserReading(meters: m, deviceID: id.uuidString))
        }
    }
}
