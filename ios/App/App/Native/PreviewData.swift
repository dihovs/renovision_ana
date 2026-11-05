#if DEBUG
import Foundation

/// Sample data for `-uiPreview` simulator screenshots of the screens behind
/// the password. Debug builds only; never real customers.
enum PreviewData {
    static var on: Bool { ProcessInfo.processInfo.arguments.contains("-uiPreview") }

    private static func iso(dayOffset: Int, _ h: Int, _ m: Int) -> String {
        let day = Calendar.current.date(byAdding: .day, value: dayOffset, to: Calendar.current.startOfDay(for: .now))!
        return ISO8601DateFormatter().string(from: day.addingTimeInterval(TimeInterval(h * 3600 + m * 60)))
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ json: String) -> T? {
        try? JSONDecoder().decode(type, from: Data(json.utf8))
    }

    static var visits: [VisitSummary] {
        decode([VisitSummary].self, """
        [{"id":"v0","jobId":"j0","title":"Final walkthrough","jobNumber":1041,"clientName":"Gagnon","startsAt":"\(iso(dayOffset: -2, 10, 0))","allDay":false,"done":false},
         {"id":"v1","jobId":"j1","title":"Basement drying check","jobNumber":1052,"clientName":"Marie Tremblay","startsAt":"\(iso(dayOffset: 0, 8, 0))","allDay":false,"done":true},
         {"id":"v2","jobId":"j2","title":"Moisture readings","jobNumber":1055,"clientName":"Syndicat Clark 7027","startsAt":"\(iso(dayOffset: 0, 13, 30))","allDay":false,"done":false},
         {"id":"v3","jobId":"j3","title":"Pick up dehumidifiers","jobNumber":1049,"clientName":"Hymus Industrial","startsAt":"\(iso(dayOffset: 0, 16, 0))","allDay":false,"done":false},
         {"id":"v4","jobId":"j4","title":"Drywall install","jobNumber":1052,"clientName":"Marie Tremblay","startsAt":"\(iso(dayOffset: 1, 8, 0))","allDay":true,"done":false}]
        """) ?? []
    }

    static var leads: [LeadSummary] {
        decode([LeadSummary].self, """
        [{"id":"l1","createdAt":"\(iso(dayOffset: 0, 9, 12))","name":"Sophie Lavoie","phone":"+15145550111","email":"s@example.com","address":"Laval-des-Rapides","status":"new","source":"website","isEmergency":true,"scopeSummary":"Water under the kitchen floor after a dishwasher leak","estimateExpected":"$4,800","unopened":true},
         {"id":"l2","createdAt":"\(iso(dayOffset: -1, 15, 40))","name":"Pierre Roy","phone":"+15145550112","email":"","address":"Chomedey","status":"contacted","source":"phone","isEmergency":false,"scopeSummary":"Basement refinish after sewer backup","estimateExpected":"$18,000","unopened":false},
         {"id":"l3","createdAt":"\(iso(dayOffset: -3, 11, 5))","name":"Nadia Cohen","phone":"+15145550113","email":"","address":null,"status":"quoted","source":"whatsapp","isEmergency":false,"scopeSummary":"Bathroom ceiling stain","estimateExpected":null,"unopened":false}]
        """) ?? []
    }

    static var conversations: [SmsConversation] {
        decode([SmsConversation].self, """
        [{"phone":"+15145550101","clientId":"1","clientName":"Marie Tremblay","lastBody":"Thanks! Is tomorrow at 8 still good for the drywall?","lastDirection":"inbound","lastAt":"\(iso(dayOffset: 0, 11, 2))","awaitingReply":true,"lastFailed":false,"messageCount":14,"optedOut":false},
         {"phone":"+15145550102","clientId":"2","clientName":"Syndicat Clark 7027","lastBody":"We'll be there at 1:30 for the readings.","lastDirection":"outbound","lastAt":"\(iso(dayOffset: -1, 17, 20))","awaitingReply":false,"lastFailed":false,"messageCount":6,"optedOut":false}]
        """) ?? []
    }

    static var quotes: [QuoteSummary] {
        decode([QuoteSummary].self, """
        [{"id":"q1","quote_number":231,"client_name":"Pierre Roy","title":"Basement refinish","status":"sent","total_cents":1800000,"sent_at":null},
         {"id":"q2","quote_number":229,"client_name":"Nadia Cohen","title":"Bathroom ceiling","status":"viewed","total_cents":45000,"sent_at":null},
         {"id":"q3","quote_number":224,"client_name":"Marie Tremblay","title":"Kitchen floor","status":"approved","total_cents":620000,"sent_at":null}]
        """) ?? []
    }
}
#endif
