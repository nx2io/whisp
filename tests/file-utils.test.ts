import { describe, expect, test } from "bun:test";
import { getFileName, isAudioFile } from "../src/bun/file-utils";

describe("file-utils", () => {
  test("isAudioFile detects audio extensions", () => {
    expect(isAudioFile("/path/to/audio.mp3")).toBe(true);
    expect(isAudioFile("/path/to/audio.wav")).toBe(true);
    expect(isAudioFile("/path/to/audio.MP3")).toBe(true);
    expect(isAudioFile("/path/to/audio.m4a")).toBe(true);
    expect(isAudioFile("/path/to/audio.ogg")).toBe(true);
    expect(isAudioFile("/path/to/audio.flac")).toBe(true);
  });

  test("isAudioFile rejects video and non-media", () => {
    expect(isAudioFile("/path/to/video.mp4")).toBe(false);
    expect(isAudioFile("/path/to/video.mov")).toBe(false);
    expect(isAudioFile("/path/to/doc.txt")).toBe(false);
    expect(isAudioFile("/path/to/doc.pdf")).toBe(false);
    expect(isAudioFile("/path/to/video.webm")).toBe(false);
  });

  test("getFileName extracts basename", () => {
    expect(getFileName("/home/user/audio.mp3")).toBe("audio.mp3");
    expect(getFileName("C:\\Users\\file.wav")).toBe("C:\\Users\\file.wav");
  });
});
