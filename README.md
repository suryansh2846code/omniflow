# OmniFlow

> Automate your Omni video editing workflows — intelligently, seamlessly, at scale.

---

## What is OmniFlow?

OmniFlow is a developer tool that automates end-to-end video editing workflows powered by [Omni](https://omni.so). It splits source videos into 10-second clips, enhances prompts using AI, automates clip processing through the Omni web interface via a Chrome extension, and merges all results into a polished final video.

---

## Vision

Video editing with AI tools like Omni is powerful — but repetitive. OmniFlow eliminates the manual loop of uploading, prompting, waiting, downloading, and stitching clips by turning it into a fully automated pipeline. The goal is a single command that takes a raw video and returns a finished edit.

---

## Current Development Phase

**Phase 0 — Project Setup**

The repository is being scaffolded. No functional code exists yet. This phase establishes the structure, documentation standards, and contribution guidelines before implementation begins.

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Project setup & repository structure | ✅ In Progress |
| 1 | Video splitter — FFmpeg-based 10-second clip extraction | 🔲 Planned |
| 2 | Prompt engine — AI-powered prompt enhancement per clip | 🔲 Planned |
| 3 | Chrome extension — browser automation for Omni clip processing | 🔲 Planned |
| 4 | Merge pipeline — stitch processed clips into a final video | 🔲 Planned |
| 5 | CLI & configuration — single-command workflow runner | 🔲 Planned |
| 6 | Packaging & release | 🔲 Planned |

---

## Project Structure

```
omniflow/
├── extension/        # Chrome extension for Omni browser automation
├── docs/             # Documentation, architecture notes, and guides
├── .gitignore
├── README.md
└── LICENSE
```

---

## Contributing

This is an early-stage side project. Contributions, ideas, and feedback are welcome. Please open an issue before submitting a pull request.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
