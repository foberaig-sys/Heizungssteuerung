"""Tests für tools/keba.py gegen einen nachgebauten Regler: `python3 -m unittest discover tools`."""
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

import keba

P = keba.PREFIX
STATE = {
    f"{P}.options.systemNumberOfHeatingCircuits": "1",
    f"{P}.options.systemNumberOfHotWaterTanks": "1",
    f"{P}.outdoorTemp.values.actValue": "11.6",
    f"{P}.heatCircuit[0].param.name": "Puffer FBH",
    f"{P}.heatCircuit[0].param.offsetRoomTemp": "0",
    f"{P}.hotWaterTank[0].topTemp.values.actValue": "47.1",
}


class FakeController(BaseHTTPRequestHandler):
    requests: list = []

    def do_POST(self):  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"] or 0)) or b"null")
        FakeController.requests.append((self.path, body, self.headers.get("Cookie")))
        if "action=set" in self.path:
            for item in body:
                STATE[item["name"]] = item["value"]
            out = []
        elif self.headers.get("Cookie") == "expired":
            self._send(b"<html>login</html>", "text/html")
            return
        else:
            out = [{"name": i["name"], "value": STATE[i["name"]]} for i in body if i["name"] in STATE]
        self._send(json.dumps(out).encode(), "application/json")

    def _send(self, data, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class KebaToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), FakeController)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def test_read_sends_hmi_payload(self):
        values = keba.Keba(self.url).read([f"{P}.outdoorTemp.values.actValue"], attributes=True)
        self.assertEqual(values[f"{P}.outdoorTemp.values.actValue"]["value"], "11.6")
        path, body, _ = FakeController.requests[-1]
        self.assertEqual(path, "/var/readWriteVars?languageCode=de")
        self.assertEqual(body, [{"name": f"{P}.outdoorTemp.values.actValue", "attr": "1"}])

    def test_set_then_status(self):
        client = keba.Keba(self.url, cookie="session")
        client.set({f"{P}.heatCircuit[0].param.offsetRoomTemp": "0.5"})
        path, body, cookie = FakeController.requests[-1]
        self.assertEqual(path, "/var/readWriteVars?action=set")
        self.assertEqual(body, [{"name": f"{P}.heatCircuit[0].param.offsetRoomTemp", "value": "0.5"}])
        self.assertEqual(cookie, "session")
        lines = keba.status(client)
        self.assertIn("heatCircuit[0].param.offsetRoomTemp = 0.5", lines)
        self.assertIn("hotWaterTank[0].topTemp.values.actValue = 47.1", lines)

    def test_html_means_expired(self):
        with self.assertRaises(keba.KebaError):
            keba.Keba(self.url, cookie="expired").read([f"{P}.outdoorTemp.values.actValue"])


if __name__ == "__main__":
    unittest.main()
