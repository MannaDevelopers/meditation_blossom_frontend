import SwiftUI

struct YoutubeMarkerView: View {
  // Android ic_youtube_widget.xml(60x60 viewport, 빨간 사각형 52x43)과 동일한
  // 가로:세로 비율을 유지하도록 크기를 맞춤 (정사각형이 아니라 가로가 더 넓은 사각형).
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 3)
        .fill(Color(red: 1, green: 0, blue: 0))
        .frame(width: 16, height: 13)
      YoutubeTriangle()
        .fill(Color.white)
        .frame(width: 6, height: 6)
    }
    .frame(width: 18, height: 18)
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
