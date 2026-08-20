//! 엔터로 문단을 나누면 모든 문단이 어느 쪽엔가 놓여야 한다.
//!
//! 신고: 쪽 마지막 줄에서 엔터를 치면 다음 쪽이 나오고 캐럿이 거기 서야 하는데, 아무
//! 반응이 없다가 글자를 입력하면 그때 쪽과 캐럿이 함께 나타난다.
//!
//! 이 시험은 그 신고를 **브라우저 없이, 비동기 없이** 엔진만으로 재현한다. 처음에는 화면
//! 갱신이나 캐럿 좌표 문제로 보였는데 둘 다 아니었다. 엔진 안에서 이미 어긋나 있었다.
//!
//! 고치기 전 실측(number-bullet.hwp):
//!
//! | 엔터 | 문단 | 쪽    | 쪽에 못 놓인 문단 |
//! | ---- | ---- | ----- | ----------------- |
//! | 1회  | 26   | 1 → 1 | 0                 |
//! | 5회  | 30   | 1 → 1 | 4                 |
//! | 30회 | 55   | 1 → 1 | 29                |
//! | 200회| 225  | 1 → 7 | 19                |
//!
//! 더한 문단 중 첫 하나만 놓이고 나머지는 빠졌다. 엔터를 30번 쳐도 쪽이 1개 그대로였다.
//! 그리고 **글자를 하나만 넣으면 29개가 전부 제자리를 찾고 쪽도 2개가 됐다** — 신고자가
//! 말한 "글자를 치면 뿅 하고 나타난다" 가 이것이다.
//!
//! ## 원인
//!
//! `typeset.rs` 의 `discard_terminal_blank_only_page` — 마지막 쪽에 빈 문단만 있으면 그
//! 쪽을 통째로 버린다. 엔터를 치면 정확히 그 모양이 만들어져 방금 만든 쪽이 사라졌다.
//!
//! 이 보정 자체는 필요하다. 큰 표의 마지막 조각 뒤에서 저장 vpos 가 다음 쪽을 가리켜
//! 없던 쪽이 생기는 것을 막는다(#3637, 한컴 2020 오라클 31쪽 → 32쪽). 그래서 없애지 않고
//! **앞 쪽이 표로 끝날 때만** 적용하도록 좁혔다 — 주석이 말하는 바로 그 사정일 때만이다.
//!
//! 아래는 원인이 아니라고 확인했다(다시 헤매지 않도록 남긴다):
//!  - 캐럿 좌표 캐시 (`cursor.getRect()`)
//!  - 화면 쪽 목록 갱신이 비동기인 것
//!  - 측정 캐시 — 구역 전체를 다시 재게 해도 그대로였다
//!  - `paginate_pass` 의 "수렴 감지" — 진단 출력일 뿐 결과를 안 건드린다
//!  - 빈 줄 감추기(`hide_empty_line`) — 이 문서에서는 꺼져 있다
//!  - 조판기를 한참 잘못 읽었다. 실제 조판은 `Paginator` 가 아니라 `TypesetEngine` 이 한다.
use std::path::Path;

use rhwp::wasm_api::HwpDocument;

fn load_doc(rel: &str) -> HwpDocument {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(rel);
    let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("read {}: {}", path.display(), e));
    HwpDocument::from_bytes(&bytes).unwrap_or_else(|e| panic!("parse {rel}: {e:?}"))
}

fn last_para(doc: &HwpDocument) -> usize {
    let mut last = 0;
    for p in 0..100_000 {
        if doc.get_paragraph_length_native(0, p).is_err() {
            break;
        }
        last = p;
    }
    last
}

/// 문단 끝에서 엔터를 `splits` 번 친 것과 같은 상태를 만든다.
fn split_at_end(doc: &mut HwpDocument, splits: usize) {
    let mut para = last_para(doc);
    let mut at = doc
        .get_paragraph_length_native(0, para)
        .expect("마지막 문단 길이");
    for _ in 0..splits {
        doc.split_paragraph_native(0, para, at, None)
            .expect("문단 나누기");
        para += 1;
        at = 0;
    }
}

/// (문단 수, 쪽에 놓이지 못한 문단 수)
fn placement(doc: &HwpDocument) -> (usize, usize) {
    let last = last_para(doc);
    let placed = (0..=last)
        .filter(|p| doc.get_cursor_rect_native(0, *p, 0).is_ok())
        .count();
    (last + 1, last + 1 - placed)
}

#[test]
fn every_paragraph_stays_on_a_page_after_repeated_enter() {
    let mut lines = Vec::new();
    let mut bad = false;
    for splits in [1usize, 5, 30, 60, 200] {
        let mut doc = load_doc("rhwp-studio/public/samples/number-bullet.hwp");
        let pages_before = doc.page_count();
        split_at_end(&mut doc, splits);
        let (total, missing) = placement(&doc);
        if missing > 0 {
            bad = true;
        }
        lines.push(format!(
            "엔터 {splits:>3}회 → 문단 {total:>3}개, 쪽 {}→{}, 못 놓인 문단 {missing}개",
            pages_before,
            doc.page_count()
        ));
    }
    assert!(!bad, "쪽에 놓이지 못한 문단이 있다:\n{}", lines.join("\n"));
}

/// 글자를 하나 넣으면 배치가 풀린다 — 원인을 좁히는 대조군.
///
/// 이쪽은 **지금도 통과한다.** 문단 나누기 경로만 뒤처진다는 증거이므로, 고칠 때 이 대조가
/// 깨지지 않는지 함께 본다.
#[test]
fn typing_after_enter_places_every_paragraph() {
    let mut doc = load_doc("rhwp-studio/public/samples/number-bullet.hwp");
    split_at_end(&mut doc, 30);
    let last = last_para(&doc);
    doc.insert_text_native(0, last, 0, "가").expect("글자 넣기");
    let (total, missing) = placement(&doc);
    assert_eq!(
        missing,
        0,
        "글자를 넣은 뒤에는 문단 {total}개가 모두 쪽에 놓여야 한다 (쪽 {}개)",
        doc.page_count()
    );
}
