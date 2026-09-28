from zeroconf import Zeroconf, ServiceInfo
import socket
import time


ip = "10.190.100.92"

info = ServiceInfo(
    "_test._tcp.local.",
    "ScreenPenTest._test._tcp.local.",
    addresses=[socket.inet_aton(ip)],
    port=9999,
    properties={
        "test": "screenpen"
    }
)

zeroconf = Zeroconf()

zeroconf.register_service(info)

print("Test mDNS service registered.")
print("Service: ScreenPenTest._test._tcp.local.")
print("IP:", ip)
print("Port: 9999")
print("Press Ctrl+C to stop.")

try:
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    pass

finally:
    zeroconf.unregister_service(info)
    zeroconf.close()