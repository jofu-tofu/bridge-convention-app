#!/bin/bash
# Start dev server with LAN sharing (WSL2)
# Usage: npm run dev:share
#
# First-time setup: run this once in Windows PowerShell (Admin):
#   netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=1420

WSL_IP=$(hostname -I | awk '{print $1}')
PORT=1420

echo ""
echo "Setting up port forwarding (WSL IP: $WSL_IP)..."

# Set up port proxy (updates each run since WSL IP can change on reboot)
powershell.exe -NoProfile -Command "\
  Start-Process powershell -Verb RunAs -Wait -ArgumentList \
  '-NoProfile -Command \"netsh interface portproxy delete v4tov4 listenport=$PORT listenaddress=0.0.0.0 2>\`\$null; netsh interface portproxy add v4tov4 listenport=$PORT listenaddress=0.0.0.0 connectport=$PORT connectaddress=$WSL_IP; netsh advfirewall firewall delete rule name=\\\"Vite Dev Server\\\" 2>\`\$null; netsh advfirewall firewall add rule name=\\\"Vite Dev Server\\\" dir=in action=allow protocol=TCP localport=$PORT\"'" 2>/dev/null

# Get Windows LAN IP for display (exclude WSL/VPN/loopback adapters)
WIN_IP=$(powershell.exe -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -match 'Ethernet|Wi-Fi' -and \$_.IPAddress -notmatch '^169|^172|^10\.' } | Select-Object -First 1).IPAddress" 2>/dev/null | tr -d '\r\n ')

if [ -z "$WIN_IP" ]; then
  WIN_IP="<your-windows-ip>"
fi

echo ""
echo "========================================="
echo "  Share this URL with the other person:"
echo "  http://${WIN_IP}:${PORT}/"
echo "========================================="
echo ""

# Start dev server with --host
npm run dev -- --host
