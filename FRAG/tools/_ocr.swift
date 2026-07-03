import Vision
import AppKit
import Foundation

func ocrRows(path: String) {
    print("=== \(URL(fileURLWithPath: path).lastPathComponent) ===")
    guard let nsImage = NSImage(contentsOfFile: path),
          let cg = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
    let w = CGFloat(cg.width), h = CGFloat(cg.height)
    let header = CGRect(x: w * 0.30, y: h * 0.72, width: w * 0.40, height: h * 0.12)
    let table = CGRect(x: w * 0.22, y: h * 0.20, width: w * 0.70, height: h * 0.62)
    for (label, rect) in [("HEADER", header), ("TABLE", table)] {
        guard let cropped = cg.cropping(to: rect) else { continue }
        let scale: CGFloat = 2
        let newW = Int(CGFloat(cropped.width) * scale)
        let newH = Int(CGFloat(cropped.height) * scale)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(data: nil, width: newW, height: newH, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
        ctx.interpolationQuality = .high
        ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: newW, height: newH))
        guard let up = ctx.makeImage() else { continue }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        let handler = VNImageRequestHandler(cgImage: up, options: [:])
        try? handler.perform([request])
        print("-- \(label) --")
        if label == "TABLE" {
            struct Line { var y: CGFloat; var items: [(x: CGFloat, text: String)] }
            var lines: [Line] = []
            for obs in request.results ?? [] {
                guard let t = obs.topCandidates(1).first?.string else { continue }
                let box = obs.boundingBox
                let y = box.origin.y
                if let idx = lines.firstIndex(where: { abs($0.y - y) < 0.018 }) {
                    lines[idx].items.append((box.origin.x, t))
                    lines[idx].y = (lines[idx].y + y) / 2
                } else { lines.append(Line(y: y, items: [(box.origin.x, t)])) }
            }
            lines.sort { $0.y > $1.y }
            for line in lines {
                let text = line.items.sorted { $0.x < $1.x }.map { $0.text }.joined(separator: " | ")
                if text.count > 2 { print(text) }
            }
        } else {
            for obs in request.results ?? [] {
                if let t = obs.topCandidates(1).first?.string { print(t) }
            }
        }
    }
}
for p in CommandLine.arguments.dropFirst() { ocrRows(path: p) }
