from zeroconf import Zeroconf, ServiceBrowser, ServiceListener
import time


class Listener(ServiceListener):

    def add_service(self, zeroconf, service_type, name):
        print("FOUND:", name)

        info = zeroconf.get_service_info(
            service_type,
            name
        )

        if info:
            print("Address:", info.parsed_addresses())
            print("Port:", info.port)


    def remove_service(self, zeroconf, service_type, name):
        print("REMOVED:", name)


    def update_service(self, zeroconf, service_type, name):
        print("UPDATED:", name)


zeroconf = Zeroconf()

listener = Listener()

browser = ServiceBrowser(
    zeroconf,
    "_screenpen._tcp.local.",
    listener
)

print("Searching for ScreenPen services...")

try:
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    pass

finally:
    zeroconf.close()