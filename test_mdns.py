from zeroconf import Zeroconf, ServiceBrowser, ServiceListener


SERVICE_TYPE = "_screenpen._tcp.local."


class ScreenPenListener(ServiceListener):

    def add_service(self, zeroconf, service_type, name):
        print()
        print("ScreenPen service found!")
        print("Service:", name)

        info = zeroconf.get_service_info(
            service_type,
            name
        )

        if info:
            print("Port:", info.port)

            addresses = [
                address
                for address in info.parsed_addresses()
                if ":" not in address
            ]

            print("Addresses:", addresses)

    def remove_service(self, zeroconf, service_type, name):
        print()
        print("ScreenPen service removed:")
        print(name)

    def update_service(self, zeroconf, service_type, name):
        print()
        print("ScreenPen service updated:")
        print(name)


zeroconf = Zeroconf()

listener = ScreenPenListener()

browser = ServiceBrowser(
    zeroconf,
    SERVICE_TYPE,
    listener
)

print(
    "Searching for ScreenPen services..."
)

try:
    input(
        "Press Enter to stop discovery..."
    )
finally:
    zeroconf.close()