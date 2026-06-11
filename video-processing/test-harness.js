import { VideoProcessingEngine } from './index.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log("==================================================");
  console.log("VIDEO PROCESSING ENGINE TEST HARNESS");
  console.log("==================================================");

  const engine = new VideoProcessingEngine();
  const hasFFmpeg = engine.splitter.hasFFmpeg;

  const testDir = path.join(process.cwd(), 'video-processing-test-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const inputVideoPath = path.join(testDir, 'test_input.mp4');
  const outputClipsDir = path.join(testDir, 'clips');

  // 1. Generate Input Video
  if (hasFFmpeg) {
    console.log("[Test] FFmpeg detected. Generating a real 15-second test MP4 video...");
    try {
      execSync(
        `ffmpeg -y -f lavfi -i testsrc=duration=15:size=640x360:rate=30 -c:v libx264 -crf 23 -pix_fmt yuv420p "${inputVideoPath}"`,
        { stdio: 'ignore' }
      );
      console.log(`[Test] Real test video generated successfully at: ${inputVideoPath}`);
    } catch (err) {
      console.error("[Test] Failed to generate test video with FFmpeg:", err.message);
      writeMockVideoFile(inputVideoPath);
    }
  } else {
    console.log("[Test] FFmpeg is not available. Using mock fallback video file.");
    writeMockVideoFile(inputVideoPath);
  }

  // 2. Run Processing Engine
  console.log("--------------------------------------------------");
  console.log("[Test] Launching VideoProcessingEngine.process...");
  try {
    const manifest = engine.process(inputVideoPath, outputClipsDir, { segmentLength: 10 });

    console.log("\n--- GENERATED PROCESSING MANIFEST ---");
    console.log(JSON.stringify(manifest, null, 2));
    console.log("--------------------------------------\n");

    // Perform Assertions
    console.log("[Test] Running assertions...");
    
    assert(manifest.sourceVideo === path.resolve(inputVideoPath), "sourceVideo path matches");
    assert(manifest.metadata, "metadata property exists");
    assert(typeof manifest.metadata.duration === 'number' && manifest.metadata.duration > 0, "metadata.duration is a positive number");
    assert(typeof manifest.metadata.fps === 'number' && manifest.metadata.fps > 0, "metadata.fps is positive");
    assert(manifest.metadata.resolution && manifest.metadata.resolution.includes('x'), "metadata.resolution format valid");
    assert(manifest.metadata.codec, "metadata.codec exists");

    const expectedClipsCount = Math.ceil(manifest.metadata.duration / 10);
    assert(manifest.clips.length === expectedClipsCount, `clips count matches duration division (expected ${expectedClipsCount}, got ${manifest.clips.length})`);

    manifest.clips.forEach((clip, index) => {
      assert(clip.clipId === index + 1, `clipId matches index+1 (expected ${index+1}, got ${clip.clipId})`);
      assert(clip.start === index * 10, `start offset matches segment (expected ${index*10}, got ${clip.start})`);
      assert(clip.duration <= 10, "clip duration is <= 10s");
      assert(clip.filePath && fs.existsSync(clip.filePath), `split clip file physically exists at path: ${clip.filePath}`);
    });

    // Verify Scene-Aware Timeline Planning
    console.log("\n[Test] Verifying scene-aware splitting capability...");
    const duration = manifest.metadata.duration;
    const sceneManifest = engine.process(inputVideoPath, path.join(testDir, 'scene_clips'), {
      scenes: [8.5]
    });
    
    console.log(`[Test] Scene-aware split segment plan generated: ${sceneManifest.clips.length} clips.`);
    if (duration === 15) {
      assert(sceneManifest.clips.length === 2, "Scene splits video of 15s at 8.5s into 2 parts");
      assert(sceneManifest.clips[0].duration === 8.5, "First clip duration matches scene marker 8.5s");
      assert(sceneManifest.clips[1].duration === 6.5, "Second clip duration matches remaining 6.5s");
    } else {
      assert(sceneManifest.clips.length === 4, "Scene splits video of 30s at 8.5s into 4 parts due to sub-splitting rules");
      assert(sceneManifest.clips[0].duration === 8.5, "First clip duration matches scene marker 8.5s");
      assert(sceneManifest.clips[1].duration === 10.0, "Second clip duration is sub-split to 10s");
      assert(sceneManifest.clips[2].duration === 10.0, "Third clip duration is sub-split to 10s");
      assert(sceneManifest.clips[3].duration === 1.5, "Fourth clip duration matches remainder 1.5s");
    }

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: All Video Processing Engine tests passed!");
    console.log("==================================================");

  } catch (err) {
    console.error("[Test] Verification execution failed:", err);
    process.exit(1);
  } finally {
    cleanup(testDir);
  }
}

function writeMockVideoFile(filePath) {
  fs.writeFileSync(filePath, Buffer.from("mock-video-binary-content"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[Assert] ${message} ✓`);
}

function cleanup(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("[Test] Failed to clean up temp dir:", e.message);
  }
}

run().catch(console.error);
