//! 선택 영역은 줄 높이를 채워 줄끼리 맞닿아야 한다.
//!
//! 신고: 여러 줄을 선택하면 줄 사이에 흰 띠가 남아 **줄무늬처럼** 보인다. 한글 2024 도
//! 구글 독스도 선택이 한 덩어리로 이어진다.
//!
//! 선택 상자 높이를 글자 상자 높이(`node.bbox.height`, 곧 글꼴 크기)로 잡고 있었다.
//! 줄과 줄의 간격은 그보다 크므로(10pt·줄간격 160% 에서 21.3px 대 13.3px) 매 줄 8px 씩
//! 비었다. 이제 `line_height + line_spacing` 을 채운다 — 글자 상자 위끼리 딱 그 간격만큼
//! 떨어져 있으므로 다음 줄 상자와 정확히 맞닿는다.

use std::path::Path;

use rhwp::wasm_api::HwpDocument;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Rect {
    y: f64,
    height: f64,
}

fn load_doc(rel: &str) -> HwpDocument {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(rel);
    let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("read {}: {}", path.display(), e));
    HwpDocument::from_bytes(&bytes).unwrap_or_else(|e| panic!("parse {rel}: {e:?}"))
}

/// 여러 줄이 되도록 긴 문단을 찾는다.
fn first_multiline_paragraph(doc: &HwpDocument) -> Option<(usize, usize)> {
    for p in 0..200 {
        let Ok(len) = doc.get_paragraph_length_native(0, p) else {
            break;
        };
        if len < 60 {
            continue;
        }
        let raw = doc.get_selection_rects(0, p as u32, 0, p as u32, len as u32).ok()?;
        let rects: Vec<Rect> = serde_json::from_str(&raw).ok()?;
        if rects.len() >= 3 {
            return Some((p, len));
        }
    }
    None
}

#[test]
fn selection_rects_touch_between_lines() {
    let doc = load_doc("rhwp-studio/public/samples/number-bullet.hwp");
    let Some((para, len)) = first_multiline_paragraph(&doc) else {
        panic!("세 줄 이상인 문단을 찾지 못했다 — 이 시험의 전제가 깨졌다");
    };

    let raw = doc
        .get_selection_rects(0, para as u32, 0, para as u32, len as u32)
        .expect("선택 사각형");
    let rects: Vec<Rect> = serde_json::from_str(&raw).expect("사각형 JSON");

    let mut gaps = Vec::new();
    for pair in rects.windows(2) {
        let gap = (pair[1].y - pair[0].y) - pair[0].height;
        // 같은 줄이 여러 조각으로 나뉜 경우(같은 y)는 건너뛴다.
        if (pair[1].y - pair[0].y).abs() > 0.01 {
            gaps.push(gap);
        }
    }

    assert!(!gaps.is_empty(), "줄이 나뉜 선택을 얻지 못했다: {rects:?}");
    // 0.5px 은 HWPUNIT ↔ px 반올림에서 나오는 오차 범위다. 옛 결함은 8px 이었다.
    for (i, gap) in gaps.iter().enumerate() {
        assert!(
            gap.abs() <= 0.5,
            "줄 {i} 와 다음 줄 사이가 {gap:.1}px 벌어졌다 — 선택이 줄무늬로 보인다"
        );
    }
}

#[test]
fn selection_rect_is_never_shorter_than_the_glyph_box() {
    // 줄 정보가 없거나 이상한 문서에서 선택이 글자보다 얇아지면 안 된다.
    let doc = load_doc("rhwp-studio/public/samples/number-bullet.hwp");
    let len = doc
        .get_paragraph_length_native(0, 0)
        .expect("첫 문단 길이");
    if len == 0 {
        return;
    }
    let raw = doc
        .get_selection_rects(0, 0, 0, 0, len as u32)
        .expect("선택 사각형");
    let rects: Vec<Rect> = serde_json::from_str(&raw).expect("사각형 JSON");
    for r in &rects {
        assert!(r.height > 0.0, "높이 0 인 선택 상자가 있다: {r:?}");
    }
}
