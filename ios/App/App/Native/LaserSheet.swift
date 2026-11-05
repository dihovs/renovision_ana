import FloorPlanCore
import SwiftUI

/// Connect a Bluetooth laser meter (floor-plan spec §13, M9) — or use the
/// simulated one to try the flow without a meter.
///
/// What a reading does is the editor's business, not this sheet's: during
/// Set Size it measures the wall being walked; with a wall selected it sets
/// that wall and moves to the next; with nothing selected it waits in the
/// tray at the top of the plan.
struct LaserSheet: View {
    /// A starting figure for the simulator — the selected wall's length.
    let suggested: Double?

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var laser = LaserMeterManager.shared
    @ObservedObject private var units = UnitSettings.shared
    @State private var simulated = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    statusRow
                    if case .connected = laser.status {
                        Button("Disconnect", role: .destructive) { laser.disconnect() }
                    }
                } footer: {
                    Text("Fire the meter at a wall: with a wall selected it sets that wall and moves to the next. During Set Size it measures the wall being walked. With nothing selected it waits at the top of the plan.")
                }

                if !laser.found.isEmpty, !isConnected {
                    Section("Meters nearby") {
                        ForEach(laser.found) { meter in
                            Button { laser.connect(meter.id) } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(meter.name).foregroundStyle(Brand.ink)
                                        Text(meter.driver).font(.caption).foregroundStyle(Brand.inkSoft)
                                    }
                                    Spacer()
                                    Image(systemName: meter.rssi > -60 ? "wifi" : "wifi.exclamationmark")
                                        .foregroundStyle(Brand.inkSoft)
                                }
                            }
                        }
                    }
                }

                Section {
                    ForEach(laser.drivers, id: \.name) { driver in
                        HStack {
                            Text(driver.name)
                            Spacer()
                            Text(driver.verified ? "Supported" : "Unverified — check a reading against a tape")
                                .font(.caption)
                                .foregroundStyle(driver.verified ? Brand.inkSoft : .orange)
                        }
                    }
                } header: {
                    Text("Meters this app knows")
                } footer: {
                    Text("Bosch GLM meters are not in the list yet: their Bluetooth protocol is not published.")
                }

                Section {
                    HStack {
                        Text("Reading")
                        Spacer()
                        TextField("—", text: $simulated)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 120)
                    }
                    Button("Send simulated reading") {
                        if let m = units.format.parse(simulated) { laser.simulate(meters: m) }
                    }
                    .disabled(units.format.parse(simulated) == nil)
                } header: {
                    Text("No meter? Simulate one")
                }
            }
            .navigationTitle("Laser meter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.bold() }
            }
            .onAppear {
                laser.start()
                if let suggested { simulated = units.format.format(suggested) }
            }
            .onDisappear { laser.stop() }
        }
    }

    private var isConnected: Bool {
        if case .connected = laser.status { return true }
        return false
    }

    private var statusRow: some View {
        HStack {
            Text("Status")
            Spacer()
            Text(statusText).foregroundStyle(Brand.inkSoft)
        }
    }

    private var statusText: String {
        switch laser.status {
        case .off: return "Bluetooth is off"
        case .unauthorized: return "Bluetooth not allowed — Settings › Renovision"
        case .unsupported: return "No Bluetooth on this device"
        case .idle: return "Not connected"
        case .scanning: return "Looking for meters…"
        case .connecting(let n): return "Connecting to \(n)…"
        case .connected(let n): return "Connected: \(n)"
        }
    }
}
