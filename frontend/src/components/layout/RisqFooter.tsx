import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/logo';
import { Github, Twitter, Linkedin, Mail, Shield, Activity, AlertTriangle } from 'lucide-react';

export function RisqFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t w-full">
      <div className="container mx-auto px-4 py-8">
        {/* Footer main section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          {/* Brand and tagline */}
          <div className="md:col-span-4 flex flex-col">
            <Logo size="md" className="mb-3" />
            <p className="text-muted-foreground">
              Secure your tomorrow, today.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Our platform delivers comprehensive risk intelligence to help organizations stay ahead of cyber threats.
            </p>
            <div className="flex space-x-4 mt-6">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </a>
              <a href="mailto:contact@example.com" className="text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-5 w-5" />
                <span className="sr-only">Email</span>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="md:col-span-2">
            <h3 className="font-medium text-foreground mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/dashboard/news/home" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  News Radar
                </Link>
              </li>
              <li>
                <Link to="/dashboard/capsule/home" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  News Capsule
                </Link>
              </li>
              <li>
                <Link to="/dashboard/threat/home" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Threat Tracker
                </Link>
              </li>
              <li>
                <Link to="/dashboard/home" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="md:col-span-2">
            <h3 className="font-medium text-foreground mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Documentation
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  API
                </Link>
              </li>
              <li>
                <Link to="/components" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Components
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h3 className="font-medium text-foreground mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Features highlight */}
          <div className="md:col-span-2">
            <h3 className="font-medium text-foreground mb-4">Features</h3>
            <ul className="space-y-3">
              <li className="flex">
                <Shield className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Advanced risk detection</span>
              </li>
              <li className="flex">
                <Activity className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Real-time monitoring</span>
              </li>
              <li className="flex">
                <AlertTriangle className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Threat intelligence</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer bottom - copyright and legal */}
        <div className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} RisqAi. All rights reserved.
          </p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link to="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link to="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}