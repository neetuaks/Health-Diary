// VisionOCR.swift
// Template iOS native module for on-device OCR using Vision.
// Add this to your Xcode project and expose as a React Native module.

import Foundation
import Vision
import UIKit

@objc(VisionOCR)
class VisionOCR: NSObject {

  @objc
  func recognize(_ uri: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: uri) ?? URL(fileURLWithPath: uri) as URL? else {
      rejecter("invalid_uri", "Invalid image uri", nil)
      return
    }

    guard let data = try? Data(contentsOf: url), let img = UIImage(data: data) else {
      rejecter("read_error", "Cannot read image at uri", nil)
      return
    }

    let request = VNRecognizeTextRequest { (req, err) in
      if let err = err {
        rejecter("vision_error", err.localizedDescription, err)
        return
      }
      var fullText = ""
      for r in req.results as? [VNRecognizedTextObservation] ?? [] {
        if let t = r.topCandidates(1).first {
          fullText += t.string + "\n"
        }
      }

      // Structured parsing: detect BP (e.g., 120/80) and glucose (mg/dL or mmol/L)
      let lowered = fullText.lowercased()

      // BP regex: capture two numbers like 120/80 or 120 / 80
      let bpPattern = "(\\b|^)(?:bp|blood pressure|b.p.)?[:\\s-]*?(\\d{2,3})\\s*[/\\\\s]\\s*(\\d{2,3})(?:\\s*(?:/|\\s)\\s*(\\d{2,3}))?"
      let glucosePattern = "(\\d{2,3}(?:\\.\\d+)?)(?:\\s*(?:mg/dl|mg dl|mgdl))|\\b(\\d{1,2}\\.?\\d?)\\s*(?:mmol/l|mmol)"

      var parameterType = "unknown"
      var values: [String: Any] = [:]
      var confidence: Double = 0.0

      if let bpRegex = try? NSRegularExpression(pattern: bpPattern, options: [.caseInsensitive]) {
        if let match = bpRegex.firstMatch(in: lowered, options: [], range: NSRange(location: 0, length: lowered.utf16.count)) {
          if match.numberOfRanges >= 3 {
            func group(_ idx: Int) -> String? {
              let ns = lowered as NSString
              let r = match.range(at: idx)
              if r.location != NSNotFound { return ns.substring(with: r) }
              return nil
            }
            if let s = group(2), let d = group(3) {
              parameterType = "bp"
              values["systolic"] = Int(s) ?? 0
              values["diastolic"] = Int(d) ?? 0
              if let p = group(4) { values["pulse"] = Int(p) ?? NSNull() }
              confidence = 0.92
            }
          }
        }
      }

      if parameterType == "unknown" {
        if let glucoseRegex = try? NSRegularExpression(pattern: glucosePattern, options: [.caseInsensitive]) {
          if let match = glucoseRegex.firstMatch(in: lowered, options: [], range: NSRange(location: 0, length: lowered.utf16.count)) {
            func capture(_ idx: Int) -> String? {
              let ns = lowered as NSString
              let r = match.range(at: idx)
              if r.location != NSNotFound { return ns.substring(with: r) }
              return nil
            }
            if let mgdl = capture(1) {
              parameterType = "glucose"
              values["value"] = Double(mgdl) ?? 0.0
              values["unit"] = "mg/dL"
              confidence = 0.85
            } else if let mmol = capture(2) {
              parameterType = "glucose"
              values["value"] = Double(mmol) ?? 0.0
              values["unit"] = "mmol/L"
              confidence = 0.78
            }
          }
        }
      }

      if parameterType == "unknown" {
        // fallback low-confidence raw text
        values["rawText"] = fullText
        confidence = 0.12
      }

      let result: [String: Any] = ["parameterType": parameterType, "values": values, "confidence": confidence, "rawText": fullText]
      resolver(result)
    }
    request.recognitionLevel = .accurate
    if let cg = img.cgImage {
      let handler = VNImageRequestHandler(cgImage: cg, options: [:])
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          rejecter("vision_error", error.localizedDescription, error)
        }
      }
    } else {
      rejecter("vision_error", "Unsupported image format", nil)
    }
  }

}
