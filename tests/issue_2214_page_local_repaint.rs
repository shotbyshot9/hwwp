//! Issue #2214 Stage 3 contracts.
//!
//! scoped layout-cache coherence와 cell-flow mutation result를 고정한다.

use std::fs;
use std::path::Path;

use rhwp::document_core::DocumentCore;
use rhwp::model::control::Control;
use rhwp::model::paragraph::Paragraph;
use rhwp::renderer::render_tree::{RenderNode, RenderNodeType};
use rhwp::wasm_api::HwpDocument;
use serde::Deserialize;

const HWP_SAMPLE: &str = "samples/issue1949_giant_cell_nested_tables_perf.hwp";
const HWPX_SAMPLE: &str = "samples/issue1949_giant_cell_nested_tables_perf.hwpx";

const SECTION: usize = 0;
const PARENT_PARAGRAPH: usize = 0;
const TABLE_CONTROL: usize = 2;
const CELL: usize = 2;
const TARGET_PARAGRAPH: usize = 5;
const INSERT_OFFSET: usize = 130;
const CELL_PATH: &str = r#"[{"controlIndex":2,"cellIndex":2,"cellParaIndex":5}]"#;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorRect {
    page_index: u32,
    x: f64,
    y: f64,
    height: f64,
    cell_bounds: Bounds,
    cell_overflowed: bool,
}

#[derive(Debug, Deserialize)]
struct Bounds {
    h: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CellEditResult {
    char_offset: usize,
    cell_flow_changed: bool,
}

fn load_sample(relative_path: &str) -> HwpDocument {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(relative_path);
    let bytes = fs::read(&path).unwrap_or_else(|e| panic!("read {relative_path}: {e}"));
    HwpDocument::from_bytes(&bytes).unwrap_or_else(|e| panic!("parse {relative_path}: {e}"))
}

fn target_paragraph(core: &DocumentCore) -> &Paragraph {
    match &core.document().sections[SECTION].paragraphs[PARENT_PARAGRAPH].controls[TABLE_CONTROL] {
        Control::Table(table) => &table.cells[CELL].paragraphs[TARGET_PARAGRAPH],
        other => panic!("target control is not a table: {other:?}"),
    }
}

fn next_paragraph_vpos(core: &DocumentCore) -> i32 {
    match &core.document().sections[SECTION].paragraphs[PARENT_PARAGRAPH].controls[TABLE_CONTROL] {
        Control::Table(table) => {
            table.cells[CELL].paragraphs[TARGET_PARAGRAPH + 1]
                .line_segs
                .first()
                .expect("target next paragraph line")
                .vertical_pos
        }
        other => panic!("target control is not a table: {other:?}"),
    }
}

fn line_starts(doc: &HwpDocument) -> Vec<usize> {
    target_paragraph(doc)
        .line_segs
        .iter()
        .map(|seg| seg.text_start as usize)
        .collect()
}

fn relative_flow_advance(para: &Paragraph) -> i64 {
    let first = para.line_segs.first().expect("target first line");
    let last = para.line_segs.last().expect("target last line");
    i64::from(last.vertical_pos) + i64::from(last.line_height) + i64::from(last.line_spacing)
        - i64::from(first.vertical_pos)
}

fn parse_cell_edit_result(raw: String) -> CellEditResult {
    serde_json::from_str(&raw).expect("cell edit result json")
}

fn insert_batch(doc: &mut HwpDocument, count: usize) -> CellEditResult {
    let raw = doc
        .insert_text_in_cell_native_deferred_pagination(
            SECTION,
            PARENT_PARAGRAPH,
            TABLE_CONTROL,
            CELL,
            TARGET_PARAGRAPH,
            INSERT_OFFSET,
            &"1".repeat(count),
        )
        .expect("batch deferred insert");
    parse_cell_edit_result(raw)
}

fn insert_sequential(doc: &mut HwpDocument, count: usize) {
    for inserted in 0..count {
        doc.insert_text_in_cell_native_deferred_pagination(
            SECTION,
            PARENT_PARAGRAPH,
            TABLE_CONTROL,
            CELL,
            TARGET_PARAGRAPH,
            INSERT_OFFSET + inserted,
            "1",
        )
        .expect("sequential deferred insert");
    }
}

fn warm_target_layout(doc: &HwpDocument) {
    doc.build_page_render_tree(0)
        .expect("warm target page tree");
    doc.get_cursor_rect_in_cell_native(
        SECTION,
        PARENT_PARAGRAPH,
        TABLE_CONTROL,
        CELL,
        TARGET_PARAGRAPH,
        INSERT_OFFSET,
    )
    .expect("warm target cursor");
}

fn target_tree_end(doc: &HwpDocument) -> usize {
    fn visit(node: &RenderNode, ranges: &mut Vec<(usize, usize)>) {
        if let RenderNodeType::TextRun(run) = &node.node_type {
            if let (Some(start), Some(ctx)) = (run.char_start, run.cell_context.as_ref()) {
                let exact_path = ctx.parent_para_index == PARENT_PARAGRAPH
                    && ctx.path.len() == 1
                    && ctx.path.first().is_some_and(|entry| {
                        entry.control_index == TABLE_CONTROL
                            && entry.cell_index == CELL
                            && entry.cell_para_index == TARGET_PARAGRAPH
                    });
                if exact_path {
                    assert!(run.char_overlap.is_none(), "target run must not overlap");
                    assert_eq!(
                        run.text.chars().count(),
                        run.text.encode_utf16().count(),
                        "fixture target run must be BMP"
                    );
                    ranges.push((start, start + run.text.encode_utf16().count()));
                }
            }
        }
        for child in &node.children {
            visit(child, ranges);
        }
    }

    let tree = doc
        .build_page_render_tree(0)
        .expect("build target page tree");
    let mut ranges = Vec::new();
    visit(&tree.root, &mut ranges);
    ranges.sort_unstable();
    assert!(!ranges.is_empty(), "target page must have text runs");
    let mut end = 0;
    for (start, next_end) in ranges {
        assert_eq!(start, end, "target ranges must have no gap or overlap");
        assert!(next_end > start, "target run must advance");
        end = next_end;
    }
    end
}

fn path_rect(doc: &HwpDocument, offset: usize) -> CursorRect {
    let raw = doc
        .get_cursor_rect_by_path_near(
            SECTION as u32,
            PARENT_PARAGRAPH as u32,
            CELL_PATH,
            offset as u32,
            0,
        )
        .expect("path-near cursor rect");
    serde_json::from_str(&raw).expect("cursor rect json")
}

fn direct_rect(doc: &HwpDocument, offset: usize) -> CursorRect {
    let raw = doc
        .get_cursor_rect_in_cell_native(
            SECTION,
            PARENT_PARAGRAPH,
            TABLE_CONTROL,
            CELL,
            TARGET_PARAGRAPH,
            offset,
        )
        .expect("direct cursor rect");
    serde_json::from_str(&raw).expect("cursor rect json")
}

fn approx_eq(actual: f64, expected: f64) -> bool {
    (actual - expected).abs() <= 0.2
}

/*
 * ## 줄 머리 금칙으로 기준값을 다시 잡았다 (2026-08)
 *
 * 아래 다섯째 줄 시작점과 캐럿 x 는 원래 **한컴 2020 adapter-save** 에서 뽑은 값이었다.
 * 그 문단은 `…대하여 적용한다.` 로 끝나고 129번이 그 마침표인데, 2020 저장본은 129에서
 * 끊어 **마침표를 혼자 새 줄에 두었다**.
 *
 * 한글 2024 는 그러지 않는다. 사용자가 본문과 **표 칸 안** 두 곳에서 찍어 확인해 주었다 —
 * 어느 쪽이든 마침표 앞 글자가 함께 내려가고, 마침표만 줄을 시작하는 경우는 없다.
 * hwwp 는 지금 사람들이 쓰는 한글과 맞아야 하므로 2024 쪽을 따른다.
 *
 * 그래서 다섯째 줄이 129 → 128 에서 시작하고, 같은 오프셋의 캐럿은 한 글자 폭(16.1px)
 * 만큼 오른쪽에 선다. y 와 쪽 수는 그대로다 — 바뀐 것은 한 줄을 어디서 끊느냐뿐이다.
 *
 * 이 값들은 **구현을 베낀 것이 아니라** 위 근거로 다시 잡은 것이다. 2020 저장본과의
 * 차이를 되살려야 할 일이 생기면 `line_breaking.rs` 의 금칙 판정을 자리에 따라 나누고
 * 여기 값을 129/573.9/621.5 로 되돌리면 된다.
 */

/// 한컴 2020 adapter-save oracle의 원본 형식별 fifth-line 전환점이다.
fn flow_boundary_insert_count(label: &str) -> usize {
    match label {
        "hwp" => 56,
        "hwpx" => 61,
        other => panic!("unknown #2214 fixture label: {other}"),
    }
}

fn expected_line_starts(label: &str, inserted: usize) -> &'static [usize] {
    if inserted >= flow_boundary_insert_count(label) {
        match label {
            "hwp" => &[0, 44, 84, 122, 128],
            "hwpx" => &[0, 45, 87, 125, 128],
            other => panic!("unknown #2214 fixture label: {other}"),
        }
    } else {
        &[0, 44, 84, 122]
    }
}

fn expected_56_path_caret(label: &str) -> (f64, f64) {
    match label {
        "hwp" => (590.0, 344.8),
        "hwpx" => (671.6, 319.2),
        other => panic!("unknown #2214 fixture label: {other}"),
    }
}

fn expected_56_direct_caret(label: &str) -> (f64, f64) {
    match label {
        "hwp" => (590.0, 345.6),
        "hwpx" => (671.6, 320.0),
        other => panic!("unknown #2214 fixture label: {other}"),
    }
}

/// Warm cache에서도 deferred edit 직후 최신 tree와 exact cursor를 반환해야 한다.
#[test]
fn issue_2214_warm_deferred_tree_and_cursor_are_exact() {
    let mut failures = Vec::new();
    for (label, sample) in [("hwp", HWP_SAMPLE), ("hwpx", HWPX_SAMPLE)] {
        let mut doc = load_sample(sample);
        assert_eq!(doc.page_count(), 115, "{label}: initial page count");
        assert_eq!(
            target_paragraph(&doc).text.encode_utf16().count(),
            INSERT_OFFSET
        );
        let original_text = target_paragraph(&doc).text.clone();
        warm_target_layout(&doc);
        insert_sequential(&mut doc, 56);

        let expected_end = INSERT_OFFSET + 56;
        assert_eq!(
            target_paragraph(&doc).text.encode_utf16().count(),
            expected_end
        );
        assert_eq!(
            target_paragraph(&doc).text,
            format!("{original_text}{}", "1".repeat(56)),
            "{label}: deferred edit must append exactly 56 characters"
        );
        let starts_after_56 = line_starts(&doc);
        let rect = path_rect(&doc, expected_end);
        assert_eq!(starts_after_56, expected_line_starts(label, 56));
        assert_eq!(
            doc.page_count(),
            115,
            "{label}: deferred edit must not paginate"
        );

        // 실제 Studio 순서처럼 path-near를 첫 observer로 둔다.
        assert!(
            approx_eq(rect.cell_bounds.h, 945.9),
            "{label}: deferred edit must retain pre-flush cell bounds: {rect:?}"
        );
        let tree_end = target_tree_end(&doc);
        let (expected_x, expected_y) = expected_56_path_caret(label);
        let exact = tree_end == expected_end
            && rect.page_index == 0
            && approx_eq(rect.x, expected_x)
            // 최신 devel의 table text baseline 보정 뒤 path-near는 direct보다
            // 0.8px 위의 caret geometry를 반환한다. 원본 형식별 기준선이
            // flush 전후에도 유지되는지를 고정한다.
            && approx_eq(rect.y, expected_y)
            && approx_eq(rect.height, 16.0)
            && !rect.cell_overflowed;
        if !exact {
            failures.push(format!(
                "{label}: model={expected_end} tree={tree_end} page={} x={:.1} y={:.1} bounds_h={:.1}",
                rect.page_index, rect.x, rect.y, rect.cell_bounds.h
            ));
        }
    }

    assert!(
        failures.is_empty(),
        "warm deferred tree/cursor must be exact:\n{}",
        failures.join("\n")
    );
}

/// Ignored matrix의 cold/direct/path 및 56/62자 대표 계약을 빠른 GREEN으로 고정한다.
/// [#2430] HY/한양 ASCII 실측 교정으로 줄 채움 임계 44→56 이동 — 대표점 56/62 이관.
#[test]
fn issue_2214_cold_representative_queries_are_exact() {
    for (label, sample) in [("hwp", HWP_SAMPLE), ("hwpx", HWPX_SAMPLE)] {
        let mut direct44 = load_sample(sample);
        insert_sequential(&mut direct44, 56);
        let direct = direct_rect(&direct44, INSERT_OFFSET + 56);
        assert_eq!(target_tree_end(&direct44), INSERT_OFFSET + 56);
        assert_eq!(direct.page_index, 0, "{label}: cold 56 direct page");
        let (expected_x, expected_y) = expected_56_direct_caret(label);
        assert!(approx_eq(direct.x, expected_x), "{label}: cold 56 direct x");
        assert!(approx_eq(direct.y, expected_y), "{label}: cold 56 direct y");
        assert!(
            approx_eq(direct.cell_bounds.h, 945.9),
            "{label}: cold 56 direct pre-flush bounds"
        );
        assert!(!direct.cell_overflowed, "{label}: cold 56 direct overflow");
        assert_eq!(direct44.page_count(), 115, "{label}: cold 56 pages");

        let mut path50 = load_sample(sample);
        insert_sequential(&mut path50, 62);
        let path = path_rect(&path50, INSERT_OFFSET + 62);
        assert_eq!(target_tree_end(&path50), INSERT_OFFSET + 62);
        assert_eq!(path.page_index, 0, "{label}: cold 62 path page");
        assert!(approx_eq(path.x, 637.7), "{label}: cold 62 path x");
        assert!(approx_eq(path.y, 344.8), "{label}: cold 62 path y");
        assert!(
            approx_eq(path.cell_bounds.h, 945.9),
            "{label}: cold 62 path pre-flush bounds"
        );
        assert!(!path.cell_overflowed, "{label}: cold 62 path overflow");
        assert_eq!(path50.page_count(), 115, "{label}: cold 62 pages");
    }
}

/// Production 신호의 입력 권위값: line-count 자체가 아니라 상대 flow advance 변화다.
#[test]
fn issue_2214_cell_flow_transition_baseline() {
    for (label, sample) in [("hwp", HWP_SAMPLE), ("hwpx", HWPX_SAMPLE)] {
        let mut doc28 = load_sample(sample);
        let original28 = target_paragraph(&doc28).text.clone();
        let initial_advance = relative_flow_advance(target_paragraph(&doc28));
        let initial_next_vpos = next_paragraph_vpos(&doc28);
        let batch_result = insert_batch(&mut doc28, 28);
        assert_eq!(batch_result.char_offset, INSERT_OFFSET + 28);
        assert!(
            !batch_result.cell_flow_changed,
            "{label}: 28-char batch must report stable cell flow"
        );
        assert_eq!(line_starts(&doc28), vec![0, 44, 84, 122]);
        assert_eq!(
            relative_flow_advance(target_paragraph(&doc28)),
            initial_advance,
            "{label}: 28-char edit must not change cell flow"
        );
        assert_eq!(
            next_paragraph_vpos(&doc28),
            initial_next_vpos,
            "{label}: 28-char edit must preserve next paragraph vpos"
        );
        assert_eq!(
            target_paragraph(&doc28).text,
            format!("{original28}{}", "1".repeat(28)),
            "{label}: 28-char batch text"
        );

        let mut doc50 = load_sample(sample);
        let original50 = target_paragraph(&doc50).text.clone();
        let mut changed_inputs = Vec::new();
        for inserted in 0..62 {
            let before = relative_flow_advance(target_paragraph(&doc50));
            let next_vpos_before = next_paragraph_vpos(&doc50);
            let result = doc50
                .insert_text_in_cell_native_deferred_pagination(
                    SECTION,
                    PARENT_PARAGRAPH,
                    TABLE_CONTROL,
                    CELL,
                    TARGET_PARAGRAPH,
                    INSERT_OFFSET + inserted,
                    "1",
                )
                .expect("per-key deferred insert");
            let result = parse_cell_edit_result(result);
            let delta = relative_flow_advance(target_paragraph(&doc50)) - before;
            let expected = if inserted + 1 == flow_boundary_insert_count(label) {
                1920
            } else {
                0
            };
            assert_eq!(
                result.char_offset,
                INSERT_OFFSET + inserted + 1,
                "{label}: input {} result offset",
                inserted + 1
            );
            assert_eq!(
                result.cell_flow_changed,
                expected != 0,
                "{label}: input {} flow result",
                inserted + 1
            );
            assert_eq!(
                delta,
                expected,
                "{label}: input {} flow delta",
                inserted + 1
            );
            assert_eq!(
                i64::from(next_paragraph_vpos(&doc50) - next_vpos_before),
                expected,
                "{label}: input {} next paragraph vpos delta",
                inserted + 1
            );
            if delta != 0 {
                changed_inputs.push(inserted + 1);
            }
        }
        assert_eq!(
            changed_inputs,
            vec![flow_boundary_insert_count(label)],
            "{label}: exactly one flow boundary"
        );
        assert_eq!(line_starts(&doc50), expected_line_starts(label, 62));
        assert_eq!(
            target_paragraph(&doc50).text,
            format!("{original50}{}", "1".repeat(62)),
            "{label}: 62-char sequential text"
        );
        assert_eq!(doc28.page_count(), 115, "{label}: 28-char page count");
        assert_eq!(doc50.page_count(), 115, "{label}: 50-char page count");
    }
}
