export const projects = [
  {
    id: 'proj1',
    title: 'Real-time Collaborative Editor',
    description: 'A multiplayer code editor with live cursors and syntax highlighting, built with WebSockets and CRDT.',
    tags: ['React', 'WebSockets', 'TypeScript', 'CRDT'],
    type: 'project' as const,
    date: 'March 2024',
    link: 'https://example.com/collab-editor',
    fullContent: `This project started from a fascination with how tools like Figma and Google Docs handle real-time collaboration. I wanted to understand the underlying technology and build something similar from scratch.

The core challenge was implementing Conflict-free Replicated Data Types (CRDTs) to ensure that concurrent edits from multiple users would converge to the same state without conflicts. I used Yjs for the CRDT implementation and integrated it with a custom WebSocket server.

Key features:
• Live cursor positions and selections for all connected users
• Operational transformation for text edits
• Syntax highlighting for 20+ programming languages
• Presence indicators showing who's currently viewing the document
• Auto-save with version history

Technical stack: React, TypeScript, Yjs, WebSocket, Monaco Editor, Node.js

The most interesting technical challenge was optimizing the WebSocket connection to handle hundreds of concurrent users without degrading performance. I implemented connection pooling and message batching to reduce bandwidth usage by 60%.`
  },
  {
    id: 'proj2',
    title: 'Neural Style Transfer App',
    description: 'Mobile-first web app that applies artistic styles to photos using machine learning.',
    tags: ['TensorFlow.js', 'React', 'ML', 'PWA'],
    type: 'project' as const,
    date: 'January 2024',
    fullContent: `An exploration into artistic machine learning, this app lets users transform their photos using pre-trained neural style transfer models.

I was inspired by the famous Neural Style Transfer paper by Gatys et al., and wanted to make this technology accessible in the browser. The app runs entirely client-side using TensorFlow.js, meaning users' photos never leave their device.

Implementation details:
• Used pre-trained MobileNetV2 as the base model
• Implemented custom training pipeline for style models
• Optimized for mobile devices with model quantization
• Progressive Web App with offline support
• Real-time preview with adjustable style strength

The biggest challenge was achieving acceptable performance on mobile devices. I reduced model size by 70% through quantization and implemented a progressive rendering approach that shows a low-res preview first.`
  },
  {
    id: 'proj3',
    title: 'Distributed Task Queue',
    description: 'High-throughput job processing system with Redis and Python, handling 10k+ tasks/minute.',
    tags: ['Python', 'Redis', 'Docker', 'Celery'],
    type: 'project' as const,
    date: 'November 2023',
    fullContent: `Built to solve a real bottleneck in our data pipeline at work. We needed to process thousands of API requests, image transformations, and database operations concurrently without blocking the main application.

Architecture:
• Celery workers distributed across multiple containers
• Redis as the message broker and result backend
• Flower for monitoring and administration
• Custom priority queue implementation
• Automatic retry logic with exponential backoff

Performance metrics:
• Processing 10,000+ tasks per minute
• 99.9% success rate with retry logic
• Average latency under 100ms
• Horizontal scaling across 20+ workers

This system reduced our batch processing time from hours to minutes and made real-time features possible that weren't feasible before.`
  }
];

export const blogs = [
  {
    id: 'blog1',
    title: 'Understanding React Server Components',
    description: 'A deep dive into the architecture and benefits of React Server Components, with practical examples.',
    tags: ['React', 'Next.js', 'Web Development'],
    type: 'blog' as const,
    date: 'April 2024',
    fullContent: `React Server Components represent a fundamental shift in how we think about rendering in React applications. This post explores the mental model and practical implications.

What are Server Components?
Server Components are React components that run exclusively on the server. They never ship to the client, which means they can access backend resources directly without an API layer.

Key Benefits:
1. Zero bundle size - Server Components don't add to your JavaScript bundle
2. Direct backend access - Query databases, read files, access secrets
3. Automatic code splitting - Only Client Components are bundled
4. Better performance - Less JavaScript to download and parse

The distinction between Server and Client Components requires a new mental model. Server Components are great for data fetching and rendering static content, while Client Components handle interactivity and browser APIs.

Practical Example:
Instead of fetching data in useEffect on the client, Server Components let you fetch during render on the server. This eliminates loading states and improves perceived performance.

The future of React is hybrid - using Server Components for the static shell and Client Components for interactive elements. This combination gives us the best of both worlds.`
  },
  {
    id: 'blog2',
    title: 'Building Accessible UIs: Beyond ARIA',
    description: 'Practical tips for creating truly accessible interfaces, focusing on keyboard navigation and screen readers.',
    tags: ['Accessibility', 'UX', 'Web Standards'],
    type: 'blog' as const,
    date: 'February 2024',
    fullContent: `Accessibility is often treated as a checklist item, but building truly accessible UIs requires understanding how people with disabilities actually use the web.

Keyboard Navigation:
Every interactive element should be keyboard accessible. This means proper focus management, visible focus indicators, and logical tab order. I use the tab key exclusively for a day when testing new features.

Screen Reader Considerations:
ARIA labels are a start, but semantic HTML is better. Use <button> instead of <div onclick>. Use <nav> for navigation. Screen readers rely on these semantic landmarks.

Real-world Examples:
• Modal dialogs should trap focus and restore it on close
• Loading states need aria-live regions
• Form errors should be announced immediately
• Skip links help keyboard users bypass repetitive content

Testing Tools:
• NVDA or JAWS for screen reader testing
• Axe DevTools for automated checks
• Keyboard-only navigation testing
• Color contrast analyzers

Accessibility isn't about compliance - it's about ensuring everyone can use what we build. Start with semantic HTML, test with actual assistive technologies, and always think about the full spectrum of users.`
  }
];

export const videos = [
  {
    id: 'vid1',
    title: 'WebGL Fundamentals: Building a 3D Scene',
    description: 'Tutorial series on WebGL basics, covering shaders, buffers, and rendering pipelines.',
    tags: ['WebGL', 'Graphics', 'JavaScript'],
    type: 'video' as const,
    date: 'May 2024',
    fullContent: `A comprehensive video series teaching WebGL from the ground up. Perfect for developers who want to understand 3D graphics on the web.

Episodes:
1. Introduction to WebGL and the rendering pipeline
2. Vertex and fragment shaders explained
3. Working with buffers and attributes
4. Textures and texture mapping
5. Lighting and materials
6. Camera controls and perspective

Each episode includes live coding and a GitHub repository with the complete code. The series builds up to a fully-featured 3D scene with lighting, textures, and camera controls.

Viewer feedback has been incredible - many have used these tutorials to build their own 3D web experiences and games.`
  },
  {
    id: 'vid2',
    title: 'System Design Interview: URL Shortener',
    description: 'Walking through the design of a scalable URL shortening service like bit.ly.',
    tags: ['System Design', 'Architecture', 'Interviews'],
    type: 'video' as const,
    date: 'March 2024',
    fullContent: `A detailed system design session covering how to build a production-ready URL shortener.

Topics Covered:
• Requirements gathering and scope definition
• Database schema design
• URL encoding algorithms (Base62)
• Caching strategy with Redis
• Rate limiting and analytics
• Scalability considerations
• Handling millions of requests per second

Architecture Decisions:
We discuss trade-offs between different approaches, why certain databases are better suited for this problem, and how to handle scale.

This video has helped many developers prepare for system design interviews at top tech companies.`
  }
];

export const academic = [
  {
    id: 'acad1',
    title: 'Optimizing Compiler Backend for RISC-V',
    description: 'Research project on improving code generation efficiency for RISC-V architecture.',
    tags: ['Compilers', 'RISC-V', 'Optimization'],
    type: 'academic' as const,
    link_to_article: 'https://example.com/risc-v-compiler-optimization',
    date: 'December 2023',
    fullContent: `Graduate research project focused on optimizing the LLVM backend for RISC-V processors.

Research Question:
Can we improve code generation efficiency for RISC-V by implementing custom instruction selection patterns and register allocation strategies?

Methodology:
• Analyzed existing LLVM RISC-V backend
• Identified optimization opportunities
• Implemented custom instruction patterns
• Benchmarked against standard compilation

Results:
Achieved 15% improvement in code size and 8% improvement in execution time on average across standard benchmarks (SPEC CPU2017).

Key Contributions:
1. Novel instruction selection patterns for common idioms
2. Improved register allocation heuristics
3. Better handling of immediate constants
4. Documentation and test suite

This work was presented at the LLVM Developers' Meeting and has been partially upstreamed to the official LLVM repository.`
  },
  {
    id: 'acad2',
    title: 'Machine Learning for Code Review',
    description: 'Master\'s thesis on using ML to predict code review outcomes and suggest improvements.',
    tags: ['Machine Learning', 'Software Engineering', 'NLP'],
    type: 'academic' as const,
    date: 'May 2023',
    fullContent: `Master's thesis exploring whether machine learning can help automate parts of the code review process.

Hypothesis:
By training models on historical code review data, we can predict which changes are likely to need revision and suggest specific improvements.

Dataset:
• 100,000+ pull requests from open source projects
• GitHub code review comments and outcomes
• Code diff analysis and AST features

Model Architecture:
Fine-tuned CodeBERT model for understanding code semantics, combined with traditional ML features for metadata and diff statistics.

Results:
• 82% accuracy in predicting review outcomes
• Generated suggestions aligned with actual reviewer feedback 65% of the time
• Reduced average review time by 30% in pilot study

Future Work:
Exploring ways to make suggestions more explainable and integrating with IDE workflows.

Published in ACM Conference on Software Engineering Education and Training.`
  }
];

export const work = [
  {
    id: 'work1',
    title: 'Senior Frontend Engineer - TechCorp',
    description: 'Led development of design system and component library used by 50+ engineers.',
    tags: ['React', 'TypeScript', 'Design Systems'],
    type: 'work' as const,
    date: '2022 - Present',
    fullContent: `Currently working as a Senior Frontend Engineer at TechCorp, focusing on developer tools and infrastructure.

Key Responsibilities:
• Architecting and maintaining the company's design system
• Building reusable component library used across 15+ products
• Mentoring junior engineers and conducting code reviews
• Leading frontend architecture discussions

Major Projects:
1. Design System 2.0 - Complete rebuild with improved accessibility and performance
2. Component Library - 100+ components with comprehensive documentation
3. Build Pipeline - Reduced build times by 60% through optimization

Impact:
• Improved developer productivity across the entire frontend team
• Reduced design inconsistencies by 80%
• Decreased time to ship new features by 40%

Technologies: React, TypeScript, Tailwind CSS, Storybook, Vite, Figma API

The most rewarding part is seeing other teams build better products faster using the tools we've created.`
  },
  {
    id: 'work2',
    title: 'Full Stack Developer - StartupXYZ',
    description: 'Early engineer helping build real-time collaboration platform from scratch.',
    tags: ['React', 'Node.js', 'PostgreSQL', 'WebSockets'],
    type: 'work' as const,
    date: '2020 - 2022',
    fullContent: `Joined StartupXYZ as the third engineer, helping build a real-time collaboration platform for remote teams.

Role & Responsibilities:
• Full stack development - React frontend, Node.js backend
• Database design and optimization
• Real-time features using WebSockets
• DevOps and deployment infrastructure

Notable Achievements:
• Built the initial product from scratch in 6 months
• Scaled system to support 10,000+ concurrent users
• Implemented real-time presence and collaborative editing
• Set up CI/CD pipeline and monitoring infrastructure

Growth:
During my time there, we grew from 3 to 25 engineers. I helped establish coding standards, interview processes, and technical onboarding.

Technology Stack:
Frontend: React, Redux, TypeScript
Backend: Node.js, Express, PostgreSQL
Infrastructure: AWS, Docker, Kubernetes

This experience taught me how to move fast while building maintainable systems, and how to make critical architectural decisions with limited information.`
  }
];

export const allContent = [...projects, ...blogs, ...videos, ...academic, ...work];
