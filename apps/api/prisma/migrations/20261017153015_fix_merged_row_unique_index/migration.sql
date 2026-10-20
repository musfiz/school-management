-- Fix: `uq_result_merged` was UNIQUE(exam_term_id, student_id, combined_group_code),
-- but both 1st/2nd paper rows AND their merged summary row share the same
-- combined_group_code, so any combined-paper subject failed to persist with
-- "Unique constraint failed on the constraint: uq_result_merged".
--
-- One merged row per student/group is still guaranteed by the engine (the merge
-- stage collapses papers through a Map, and `persist` rebuilds the whole term's
-- snapshot inside a single transaction). The unique index is replaced with a
-- plain lookup index; `uq_result_subject` still guards the non-merged rows.
DROP INDEX `uq_result_merged` ON `student_subject_results`;

CREATE INDEX `IDX_SUBJECT_RESULTS_TERM_STUDENT_GROUP` ON `student_subject_results`(`exam_term_id`, `student_id`, `combined_group_code`);
