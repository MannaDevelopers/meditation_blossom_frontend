import SwiftUI

struct YoutubeMarkerView: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 3)
        .fill(Color(red: 1, green: 0, blue: 0))
      YoutubeTriangle()
        .fill(Color.white)
        .frame(width: 6, height: 7)
    }
    .frame(width: 16, height: 16)
  }
}

private struct YoutubeTriangle: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
    path.closeSubpath()
    return path
  }
}
