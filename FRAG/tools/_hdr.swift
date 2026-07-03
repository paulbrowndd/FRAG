import Vision
import AppKit
import Foundation

let path = CommandLine.arguments[1]
guard let ns = NSImage(contentsOfFile: path),
      let cg = ns.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let w = CGFloat(cg.width), h = CGFloat(cg.height)
let crop = CGRect(x: w * 0.30, y: h * 0.86, width: w * 0.40, height: h * 0.10)
guard let c = cg.cropping(to: crop) else { exit(1) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
try? VNImageRequestHandler(cgImage: c, options: [:]).perform([req])
for o in req.results ?? [] {
    print(o.topCandidates(1).first?.string ?? "")
}
