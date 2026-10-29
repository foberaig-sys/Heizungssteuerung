"""Tests für tools/modbus_scan.py gegen einen nachgebauten Modbus-TCP-Server: `python3 -m unittest discover tools`."""
import socketserver
import struct
import threading
import unittest

import modbus_scan

# Register 401 = 478 (47,8 °C), 601 = 312, 707 = 1450 W, 50 = -12 (-1,2 °C). Ab 900 gibt es nichts (Ausnahme 2).
REGISTERS = {401: 478, 601: 312, 707: 1450, 50: (-12) & 0xFFFF}
LIMIT = 900


class FakeModbus(socketserver.BaseRequestHandler):
    def handle(self):
        while True:
            header = self.request.recv(7)
            if len(header) < 7:
                return
            tid, _proto, length, unit = struct.unpack(">HHHB", header)
            function, address, count = struct.unpack(">BHH", self.request.recv(length - 1))
            if address + count > LIMIT:
                pdu = struct.pack(">BB", function | 0x80, 2)
            else:
                data = [REGISTERS.get(address + i, 0) for i in range(count)]
                pdu = struct.pack(f">BB{count}H", function, count * 2, *data)
            self.request.sendall(struct.pack(">HHHB", tid, 0, len(pdu) + 1, unit) + pdu)


class ModbusScanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), FakeModbus)
        cls.server.daemon_threads = True
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_scan_reads_values_and_skips_missing_ranges(self):
        client = modbus_scan.ModbusClient("127.0.0.1", self.port)
        try:
            values = modbus_scan.scan(client, modbus_scan.READ_HOLDING, 0, 1000)
        finally:
            client.close()
        self.assertEqual(values[401], 478)
        self.assertEqual(values[707], 1450)
        self.assertEqual(modbus_scan.signed(values[50]), -12)
        self.assertNotIn(950, values)
        self.assertEqual(len(values), LIMIT)

    def test_matches_scaled_values(self):
        self.assertEqual(modbus_scan.matches(478, [47.8]), ["47.8 (x0,1)"])
        self.assertEqual(modbus_scan.matches((-12) & 0xFFFF, [-1.2]), ["-1.2 (x0,1)"])
        self.assertEqual(modbus_scan.matches(1450, [22.0]), [])

    def test_main_prints_hits(self):
        import io
        from contextlib import redirect_stdout
        out = io.StringIO()
        with redirect_stdout(out):
            code = modbus_scan.main(["--host", "127.0.0.1", "--port", str(self.port), "--end", "800", "--find", "47.8"])
        self.assertEqual(code, 0)
        self.assertRegex(out.getvalue(), r"401 +478 +478 +47\.8 +47\.8 \(x0,1\)  <==")

    def test_compare_shows_only_changes(self):
        import io
        import os
        import tempfile
        from contextlib import redirect_stdout
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "vorher.csv")
            with redirect_stdout(io.StringIO()):
                modbus_scan.main(["--host", "127.0.0.1", "--port", str(self.port), "--end", "800", "--csv", path])
            REGISTERS[402] = 490  # am Display Warmwasser-Soll auf 49,0 gestellt
            REGISTERS[401] = 470
            try:
                out = io.StringIO()
                with redirect_stdout(out):
                    code = modbus_scan.main(["--host", "127.0.0.1", "--port", str(self.port), "--end", "800",
                                             "--compare", path])
            finally:
                del REGISTERS[402]
                REGISTERS[401] = 478
        self.assertEqual(code, 0)
        text = out.getvalue()
        self.assertIn("2 Register haben sich", text)
        self.assertRegex(text, r"401 +478 +470")
        self.assertRegex(text, r"402 +0 +490 +0\.0 +49\.0")
        self.assertNotIn("707", text)


if __name__ == "__main__":
    unittest.main()
