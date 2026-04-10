# SpoolmanSync Add-on

Automatic filament tracking for Bambu Lab and Creality printers with Spoolman.

## Installation

1. Add this repository to your Home Assistant add-on store:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click **⋮** (top right) → **Repositories**
   - Add: `https://github.com/gibz104/SpoolmanSync`
2. Find **SpoolmanSync** and click **Install**
3. Start the add-on and enable **Show in sidebar**

## Configuration

| Option | Description |
|--------|-------------|
| `spoolman_url` | URL to your Spoolman instance (e.g., `http://192.168.1.100:7912`) |
| `port` | Port for direct access / QR code scanning (default: `3000`). Change this if another add-on or service is already using port 3000. |

You can also configure the Spoolman URL from the SpoolmanSync Settings page after opening the add-on.

## Requirements

- **Spoolman** running and accessible from Home Assistant
- For Bambu Lab printers: **ha-bambulab** integration installed via [HACS](https://hacs.xyz/)
- For Creality printers: **ha_creality_ws** integration installed via [HACS](https://hacs.xyz/)

## Full Documentation

For detailed usage instructions, feature guides, and troubleshooting, see the [SpoolmanSync documentation](https://github.com/gibz104/SpoolmanSync#readme).

## Support

[GitHub Issues](https://github.com/gibz104/SpoolmanSync/issues)
