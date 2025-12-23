
#!/bin/bash

set -e

echo "🔧 Decoding Firebase configuration files..."

if [ -n "$GOOGLE_SERVICES_JSON" ]; then

  echo "📱 Creating google-services.json for Android..."

  echo "$GOOGLE_SERVICES_JSON" | base64 -d > ./google-services.json

  echo "✅ google-services.json created"

else

  echo "⚠️  GOOGLE_SERVICES_JSON not found"

fi

if [ -n "$GOOGLE_SERVICES_PLIST" ]; then

  echo "🍎 Creating GoogleService-Info.plist for iOS..."

  echo "$GOOGLE_SERVICES_PLIST" | base64 -d > ./GoogleService-Info.plist

  echo "✅ GoogleService-Info.plist created"

else

  echo "⚠️  GOOGLE_SERVICES_PLIST not found"

fi

echo "🎉 Firebase configuration files ready!"

