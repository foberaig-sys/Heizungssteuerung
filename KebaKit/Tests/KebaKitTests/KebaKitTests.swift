import XCTest
@testable import KebaKit

final class KebaModelTests: XCTestCase {
    func testDecodesReadResponseWithAttributes() throws {
        let json = """
        [{"name":"APPL.CtrlAppl.sParam.outdoorTemp.values.actValue",
          "attributes":{"formatId":"fmtTemp","longText":"Exterior temp.","lowerLimit":"-100","unitId":"Temp","upperLimit":"100"},
          "value":"10.808357"},
         {"name":"APPL.CtrlAppl.sParam.heatCircuit[0].param.name","value":"Puffer FBH"},
         {"name":"APPL.CtrlAppl.sParam.heatCircuit[0].values.heatRequest","value":"true"}]
        """
        let vars = try KebaClient.decodeVariables(Data(json.utf8))
        XCTAssertEqual(vars.count, 3)
        XCTAssertEqual(vars[0].double ?? 0, 10.808357, accuracy: 0.000001)
        XCTAssertEqual(vars[0].attributes?.range, -100...100)
        XCTAssertEqual(vars[1].value, "Puffer FBH")
        XCTAssertEqual(vars[2].bool, true)
    }

    func testDecodesNumericValues() throws {
        let json = #"[{"name":"a","value":3},{"name":"b","value":21.5},{"name":"c","value":false}]"#
        let vars = try KebaClient.decodeVariables(Data(json.utf8))
        XCTAssertEqual(vars.map(\.value), ["3", "21.5", "false"])
    }

    func testDecodesSingleObject() throws {
        let json = #"{"name":"APPL.CtrlAppl.sParam.hmiRetainData.systemLanguage","value":"de"}"#
        XCTAssertEqual(try KebaClient.decodeVariables(Data(json.utf8)).first?.value, "de")
    }

    func testReadRequestMatchesHMIFormat() throws {
        let body = try JSONEncoder().encode([
            KebaClient.ReadRequest(name: "x", attr: "1"),
            KebaClient.ReadRequest(name: "y", attr: nil),
        ])
        let decoded = try JSONSerialization.jsonObject(with: body) as? [[String: String]]
        XCTAssertEqual(decoded ?? [], [["name": "x", "attr": "1"], ["name": "y"]])
    }

    func testNumberFormatting() {
        XCTAssertEqual(KebaFormat.number(0), "0")
        XCTAssertEqual(KebaFormat.number(0.5), "0.5")
        XCTAssertEqual(KebaFormat.number(-1.5), "-1.5")
        XCTAssertEqual(KebaFormat.number(22), "22")
        XCTAssertEqual(KebaFormat.number(47.25), "47.25")
        XCTAssertEqual(KebaFormat.number(0.1 + 0.2), "0.3")
    }

    func testHTMLMeansSessionExpired() {
        XCTAssertThrowsError(try KebaClient.validate(status: 200, contentType: "text/html", data: Data("<html>".utf8))) {
            XCTAssertEqual($0 as? KebaError, .sessionExpired)
        }
        XCTAssertThrowsError(try KebaClient.validate(status: 200, contentType: nil, data: Data("  <!DOCTYPE".utf8))) {
            XCTAssertEqual($0 as? KebaError, .sessionExpired)
        }
        XCTAssertThrowsError(try KebaClient.validate(status: 401, contentType: nil, data: Data())) {
            XCTAssertEqual($0 as? KebaError, .unauthorized)
        }
        XCTAssertThrowsError(try KebaClient.validate(status: 500, contentType: "application/json",
                                                     data: Data(#"{"developerMessage":"unknown var"}"#.utf8))) {
            XCTAssertEqual($0 as? KebaError, .server("unknown var"))
        }
    }

    func testFirstInteger() {
        XCTAssertEqual(KebaClient.firstInteger(in: Data("3".utf8)), 3)
        XCTAssertEqual(KebaClient.firstInteger(in: Data(#"{"count": 12}"#.utf8)), 12)
        XCTAssertNil(KebaClient.firstInteger(in: Data("{}".utf8)))
    }

    func testOrigin() {
        XCTAssertEqual(KebaClient.origin(of: URL(string: "https://remote.keba.com:59238/")!),
                       "https://remote.keba.com:59238")
        XCTAssertEqual(KebaClient.origin(of: URL(string: "http://192.168.1.50")!), "http://192.168.1.50")
    }
}

final class HeatingServiceTests: XCTestCase {
    func testSnapshotAssembly() async throws {
        let p = "APPL.CtrlAppl.sParam"
        let fake = FakeTransport(values: [
            "\(p).options.systemNumberOfHeatingCircuits": "2",
            "\(p).options.systemNumberOfHotWaterTanks": "1",
            "\(p).outdoorTemp.values.actValue": "11.6",
            "\(p).param.operatingMode": "2",
            "\(p).heatCircuit[0].param.name": "Puffer FBH",
            "\(p).heatCircuit[0].values.setValue": "22.0",
            "\(p).heatCircuit[0].param.offsetRoomTemp": "0.5",
            "\(p).heatCircuit[0].param.operatingMode": "1",
            "\(p).options.heatCircuit[0].hasRoomTemp": "false",
            "\(p).heatCircuit[0].tempRoom.values.actValue": "-99",
            "\(p).heatCircuit[1].param.name": "Heizkörper",
            "\(p).hotWaterTank[0].topTemp.values.actValue": "47.1",
            "\(p).hotWaterTank[0].param.normalSetTempMax.value": "50",
            "\(p).hotWaterTank[0].param.operatingMode": "1",
        ], limits: ["\(p).heatCircuit[0].param.offsetRoomTemp": ("-5", "5")])

        let snapshot = try await HeatingService(transport: fake).loadSnapshot()
        XCTAssertEqual(snapshot.outdoorTemperature, 11.6)
        XCTAssertEqual(snapshot.systemOperatingMode, .autoHeat)
        XCTAssertEqual(snapshot.heatCircuits.map(\.name), ["Puffer FBH", "Heizkörper"])
        XCTAssertEqual(snapshot.heatCircuits[0].currentSetTemperature, 22.0)
        XCTAssertEqual(snapshot.heatCircuits[0].offset, Setpoint(value: 0.5, range: -5...5))
        XCTAssertEqual(snapshot.heatCircuits[0].operatingMode, .auto)
        XCTAssertNil(snapshot.heatCircuits[0].roomTemperature, "Ohne Raumfühler keine Raumtemperatur anzeigen")
        XCTAssertEqual(snapshot.hotWaterTanks.count, 1)
        XCTAssertEqual(snapshot.hotWaterTanks[0].name, "Warmwasser")
        XCTAssertEqual(snapshot.hotWaterTanks[0].temperature, 47.1)
        XCTAssertEqual(snapshot.hotWaterTanks[0].setTemperature?.value, 50)
        XCTAssertEqual(snapshot.hotWaterTanks[0].operatingMode, .auto)
    }

    func testWritesUseHMIFormat() async throws {
        let fake = FakeTransport(values: [:])
        let service = HeatingService(transport: fake)
        try await service.setOffset(0.5, circuit: 0)
        try await service.setHotWaterMode(.heatUp, tank: 0)
        let writes = await fake.recordedWrites()
        XCTAssertEqual(writes, [
            KebaWrite(name: "APPL.CtrlAppl.sParam.heatCircuit[0].param.offsetRoomTemp", value: "0.5"),
            KebaWrite(name: "APPL.CtrlAppl.sParam.hotWaterTank[0].param.operatingMode", value: "3"),
        ])
    }
}

actor FakeTransport: KebaTransport {
    let values: [String: String]
    let limits: [String: (String, String)]
    private var writes: [KebaWrite] = []

    init(values: [String: String], limits: [String: (String, String)] = [:]) {
        self.values = values
        self.limits = limits
    }

    func read(_ names: [String], withAttributes: Bool) async throws -> [String: KebaVariable] {
        var out: [String: KebaVariable] = [:]
        for name in names {
            guard let value = values[name] else { continue }
            let attributes = limits[name].map { KebaAttributes(lowerLimit: $0.0, upperLimit: $0.1) }
            out[name] = KebaVariable(name: name, value: value, attributes: withAttributes ? attributes : nil)
        }
        return out
    }

    func write(_ values: [KebaWrite]) async throws {
        writes += values
    }

    func recordedWrites() -> [KebaWrite] { writes }
}
