# Security Policy

## Overview
This document outlines the security policies and best practices for the **Kubemate** project.

## Table of Contents
- Overview
- Code of Conduct
- Reporting Vulnerabilities

---

## Code of Conduct

### Reporting Security Issues
If you discover a security vulnerability, please **DO NOT**:

- ❌ Create a public GitHub issue  
- ❌ Post about it publicly  
- ❌ Discuss it in public channels  
- ❌ Exploit the vulnerability  

### Responsible Disclosure
If you find a security vulnerability, please follow our responsible disclosure process:

- **Email us privately at:** `mehdichebbi111@gmail.com`
- Include a detailed description of the vulnerability
- Include steps to reproduce
- Include potential impact
- Include a suggested fix (if any)

### Response Timeline
We will respond within **48 hours**:
- Confirm receipt of your report
- Provide an initial assessment
- Give a timeline for a fix
- Coordinate disclosure with you

### Disclosure Timeline
| Severity | Timeline |
|--------|---------|
| Critical | Within 7 days of fix |
| High | Within 14 days of fix |
| Medium | Within 30 days of fix |
| Low | At next minor release |

### Credit
- Security researchers who report vulnerabilities will be credited
- Disclosure timing can be coordinated
- You may request a security advisory published with your name

---

## Reporting Vulnerabilities

### What to Include in Your Report

#### Required Information
- Type of vulnerability (XSS, SQLi, authentication bypass, etc.)
- Affected versions (git commit hash, version tags)
- Steps to reproduce
- Proof of concept (if available)
- Potential impact

#### Optional but Helpful
- Screenshots or videos
- Suggested fix or mitigation
- Your public key (for encryption)
- Contact information

### Vulnerability Severity Levels

| Severity | Definition | Example |
|--------|-----------|---------|
| Critical | Full system compromise without user interaction | RCE in production |
| High | Unauthorized access to sensitive data | SQL injection |
| Medium | Limited impact, requires interaction | XSS |
| Low | Minimal impact | Minor information disclosure |
| Informational | No direct impact | Missing security headers |

---
