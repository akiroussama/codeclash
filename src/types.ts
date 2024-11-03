export interface TestResult  
 {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  total?: number;
  testFiles: string[];
  failureDetails: Array<{
    testName: string;
    error: string;
    duration?: number;
  }>;
}

export interface TestRunMetadata {
    timestamp: string;
    projectInfo: {
      name: string;
      version: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    environment: {
      nodeVersion: string;
      vscodeVersion: string;
      platform: string;
      osInfo: {
        platform: string;
        release: string;
        arch: string;
        memory: {
          total: number;
          free: number;
        };
        cpus: {
          model: string;
          speed: number;
          cores: number;
        };
      };
      workspace: {
        name: string;
        path: string;
        gitInfo?: {
          branch: string;
          commit: string;
          remote: string;
        };
      };
    };
    testRunner: {
      name: string;
      version: string;
      config: any;
    };
    execution: {
      startTime: string;
      endTime: string;
      duration: number;
      exitCode: number;
    };
  }

  
