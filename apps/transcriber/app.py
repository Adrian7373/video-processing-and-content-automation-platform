import os
import tempfile
from functools import lru_cache
from typing import Any, TypedDict

import whisperx
from faster_whisper import WhisperModel
from flask import Flask, jsonify, request
from werkzeug.datastructures import FileStorage

app = Flask(__name__)

DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")


class TranscriptSegment(TypedDict):
    start: float
    end: float
    text: str


class TranscriptionResponse(TypedDict):
    segments: list[TranscriptSegment]
    language: str


@lru_cache(maxsize=1)
def get_whisper_model() -> WhisperModel:
    return WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)


def extract_sanitized_words(aligned_segments):
    """
    Extracts word-level timestamps from WhisperX aligned segments.
    Interpolates missing timestamps for numbers/punctuation that WhisperX failed to align.
    """
    words_output = []
    for seg in aligned_segments:
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", seg_start + 1.0))
        seg_words = seg.get("words", [])
        if not seg_words:
            continue

        num_words = len(seg_words)
        fallback_duration = max(
            0.05, (seg_end - seg_start) / max(1, num_words))

        last_end = seg_start
        for idx, w in enumerate(seg_words):
            raw_text = str(w.get("word", "")).strip()
            if not raw_text:
                continue

            w_start = w.get("start")
            w_end = w.get("end")

            if w_start is None:
                w_start = last_end
            else:
                w_start = float(w_start)

            if w_end is None or float(w_end) <= w_start:
                w_end = min(seg_end, w_start + fallback_duration)
            else:
                w_end = float(w_end)

            last_end = w_end
            words_output.append({
                "word": raw_text,
                "start": round(w_start, 3),
                "end": round(w_end, 3),
            })

    return words_output


def transcribe_audio(audio_path: str) -> TranscriptionResponse:
    """Transcribe audio with faster-whisper and align timestamps with WhisperX."""
    model = get_whisper_model()
    segments, info = model.transcribe(audio_path)
    transcript_segments = [
        {"start": segment.start, "end": segment.end, "text": segment.text}
        for segment in segments
    ]

    align_model, align_metadata = whisperx.load_align_model(
        language_code=info.language,
        device=DEVICE,
    )
    aligned = whisperx.align(
        transcript_segments,
        align_model,
        align_metadata,
        audio_path,
        DEVICE,
        return_char_alignments=False,
    )

    return {
        "segments": [
            {
                "start": float(segment["start"]),
                "end": float(segment["end"]),
                "text": str(segment["text"]),
            }
            for segment in aligned["segments"]
        ],
        "language": info.language,
    }


@app.post("/transcribe")
def transcribe() -> tuple[Any, int]:
    uploaded_file: FileStorage | None = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"error": "An audio file is required in the 'file' field."}), 400

    file_suffix = os.path.splitext(uploaded_file.filename)[1]
    temporary_file = tempfile.NamedTemporaryFile(
        prefix="video-repurposer-",
        suffix=file_suffix,
        delete=False,
    )
    temporary_path = temporary_file.name
    temporary_file.close()

    try:
        uploaded_file.save(temporary_path)
        result = transcribe_audio(temporary_path)

        return jsonify({"words": extract_sanitized_words(result["segments"])}), 200
    finally:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
