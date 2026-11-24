module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      androidGoogleMapsApiKey
        ? ['react-native-maps', { androidGoogleMapsApiKey }]
        : 'react-native-maps',
    ],
    extra: {
      ...config.extra,
      androidGoogleMapsApiKeyConfigured: Boolean(androidGoogleMapsApiKey),
    },
  };
};
