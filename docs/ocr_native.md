Native OCR integration (iOS & Android)

Overview
- Purpose: Run all image text recognition on-device (no cloud) and return a structured prefill for the generic `NewRecordModal` form.
- The JS `src/services/ocr.ts` expects a bridge that exposes a single method `recognizeImage(uri: string): Promise<RecognizedResult[]>` where `RecognizedResult` contains `{ parameterTypeId?: string; values: Record<string,string>; confidence: number }`.

iOS (Vision) — Swift template
- Create a React Native native module (or Expo config plugin to include it) that exposes `recognizeImage(_ uri: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock)`.
- The module should use `VNRecognizeTextRequest` with `.accurate` recognitionLevel and `VNImageRequestHandler` on the locally-stored image URL.
- Parse recognized text into key/value pairs (e.g., "BP 120/80" → parameterTypeId for BP and values `{ systolic: "120", diastolic: "80" }`). Return confidence scores.

Swift bridge notes
- You can implement the module in Swift and expose it to React Native using an Objective-C extern file. Example `VisionOCRBridge.m`:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VisionOCR, NSObject)
RCT_EXTERN_METHOD(recognize:(NSString *)uri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
```

- The Swift class should be annotated with `@objc(VisionOCR)` and provide a matching `recognize(_ uri: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock)` method. See `native/ios/VisionOCR.swift` as a starting template.
- After adding the native files to an Expo project you will need to run `expo prebuild` (or eject to Bare) and open the generated Xcode project to build and test.

Expo config plugin
- A lightweight plugin is included at `plugins/vision-ocr-plugin` that copies the native templates into the generated native projects during `expo prebuild`. Add it to your `app.json` as shown in the plugin README.

Android (ML Kit) — Kotlin template
- Create a React Native native module that exposes `fun recognizeImage(uri: String, promise: Promise)` and runs Google ML Kit on-device Text Recognition.
- Use `InputImage.fromFilePath(context, Uri.parse(uri))` and `TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)`.
- Parse the result similarly into structured values and return via the promise.

Android registration note
- After `expo prebuild` you'll have an Android project under `android/`. If the module does not appear to be registered automatically,
	add your package to the list returned by `getPackages()` in `android/app/src/main/java/.../MainApplication.java`:

```java
import com.healthdiary.ocr.MLKitOCRPackage;
// ...
@Override
protected List<ReactPackage> getPackages() {
	List<ReactPackage> packages = new PackageList(this).getPackages();
	packages.add(new MLKitOCRPackage());
	return packages;
}
```

The included Expo config plugin `plugins/vision-ocr-plugin` copies the Kotlin templates into the generated project and attempts to add the ML Kit Gradle dependency during `expo prebuild`, but you may need to verify and add the package manually in `MainApplication.java` if autolinking doesn't pick it up.

Security & privacy
- Never send images off-device. Do not include any network requests in the native module.
- Only return structured values and confidence; do not persist images within the module.

Testing
- Add sample test images to `assets/test_images/` and a small smoke test in `__tests__/ocr_native.test.ts` that calls the JS wrapper and asserts a high-confidence result for known fixtures.

Notes for Expo
- To include native modules in Expo-managed workflow, you must either eject (Bare) or implement an Expo Config Plugin that adds the native sources to the native projects. Document these steps in your README when you decide which route to take.
