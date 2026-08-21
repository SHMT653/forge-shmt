#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Exposes the Swift plugin to Capacitor's runtime under the name the web layer
// looks up (Capacitor.Plugins.ForgeHealth).
CAP_PLUGIN(ForgeHealthPlugin, "ForgeHealth",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getAuthorizationStatus, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(querySteps, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(querySleep, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWeight, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryActiveEnergy, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryDistance, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkouts, CAPPluginReturnPromise);
)
