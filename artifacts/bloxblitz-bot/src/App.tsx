import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Terminal, BarChart4, ChevronRight, CheckCircle2, Server, Command, Lock, Users } from "lucide-react";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-6 h-6 text-primary" />
          <span className="font-mono font-bold text-xl tracking-tighter">BLOXBLITZ<span className="text-primary">_</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-mono text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">FEATURES</a>
          <a href="#stats" className="hover:text-primary transition-colors">NETWORK</a>
          <a href="#security" className="hover:text-primary transition-colors">SECURITY</a>
        </div>
        <Button variant="default" className="font-mono font-bold tracking-tight bg-primary text-primary-foreground hover:bg-primary/90 glow-box-primary rounded-none" asChild>
          <a href="https://discord.com/oauth2/authorize?client_id=1499011937256734771&permissions=268561488&scope=bot%20applications.commands" target="_blank" rel="noreferrer" data-testid="link-add-discord-nav">INITIATE CONNECTION</a>
        </Button>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-16 overflow-hidden noise-bg">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0"></div>
      
      <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/5 text-primary text-xs font-mono w-fit">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            SYSTEM ONLINE // V2.4.1 DEPLOYED
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] glow-text-primary">
            THE APEX MIDDLEMAN INFRASTRUCTURE.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-lg leading-relaxed">
            Fast, secure, and ruthless efficiency for serious Roblox traders. Automated coinflips, secure ticket sessions, and flawless logging. No bloat. No downtime.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button size="lg" className="h-14 px-8 font-mono text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-none glow-box-primary" asChild>
              <a href="https://discord.com/oauth2/authorize?client_id=1499011937256734771&permissions=268561488&scope=bot%20applications.commands" target="_blank" rel="noreferrer" data-testid="link-add-discord-hero">
                ADD TO DISCORD <ChevronRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 font-mono text-base font-bold rounded-none border-primary/20 hover:bg-primary/5" asChild>
              <a href="#features" data-testid="link-view-docs">
                READ DOCS
              </a>
            </Button>
          </div>
          
          <div className="flex items-center gap-6 mt-8 pt-8 border-t border-border/50">
            <div className="flex flex-col">
              <span className="font-mono text-3xl font-bold text-foreground">42M+</span>
              <span className="font-mono text-xs text-muted-foreground">RAP SECURED</span>
            </div>
            <div className="w-px h-10 bg-border/50"></div>
            <div className="flex flex-col">
              <span className="font-mono text-3xl font-bold text-foreground">12.4K</span>
              <span className="font-mono text-xs text-muted-foreground">ACTIVE SERVERS</span>
            </div>
            <div className="w-px h-10 bg-border/50"></div>
            <div className="flex flex-col">
              <span className="font-mono text-3xl font-bold text-foreground">99.9%</span>
              <span className="font-mono text-xs text-muted-foreground">UPTIME</span>
            </div>
          </div>
        </div>
        
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full"></div>
          <img 
            src="/hero-network.png" 
            alt="BloxBlitz Infrastructure" 
            className="w-full aspect-square object-cover rounded-sm border border-primary/20 relative z-10"
            data-testid="img-hero-viz"
          />
          
          {/* Floating UI Elements */}
          <div className="absolute top-10 -left-10 bg-card border border-primary/30 p-4 z-20 font-mono shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-8 mb-2">
              <span className="text-xs text-muted-foreground">SESSION_ID</span>
              <span className="text-xs text-primary">#8492</span>
            </div>
            <div className="text-sm">TICKET GENERATED</div>
            <div className="w-full h-1 bg-border mt-2 overflow-hidden">
              <div className="h-full bg-primary w-full animate-pulse"></div>
            </div>
          </div>
          
          <div className="absolute bottom-20 -right-10 bg-card border border-accent/30 p-4 z-20 font-mono shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">COINFLIP RESOLVED</div>
                <div className="text-sm font-bold text-foreground">WINNER: USER_X99</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Server className="w-8 h-8 text-primary" />,
      title: "TICKET-BASED MM",
      desc: "Isolated channel generation for every trade. Full transcript logging. Clean, structured, and auditable."
    },
    {
      icon: <Zap className="w-8 h-8 text-accent" />,
      title: "COINFLIP SESSIONS",
      desc: "Provably fair RNG coinflips. Automated call-outs, fast resolution, no dispute capability. Pure execution."
    },
    {
      icon: <Shield className="w-8 h-8 text-primary" />,
      title: "VOUCH REMINDERS",
      desc: "Aggressive reputation building. Automated pings post-trade to ensure vouches are captured and logged."
    },
    {
      icon: <Command className="w-8 h-8 text-accent" />,
      title: "STAFF COMMANDS",
      desc: "Granular permission scaling. Kick, ban, mute, or override sessions directly through slash commands."
    }
  ];

  return (
    <section id="features" className="py-24 bg-card/30 border-y border-border/50 relative noise-bg">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase">Operational <span className="text-primary glow-text-primary">Capabilities</span></h2>
          <p className="font-mono text-muted-foreground mt-4 max-w-2xl">Everything required to run a high-volume trading server. Nothing you don't.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-background border border-border/50 p-8 hover:border-primary/50 transition-colors group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="mb-6 relative z-10">{f.icon}</div>
              <h3 className="text-xl font-bold font-mono tracking-tight mb-3 relative z-10">{f.title}</h3>
              <p className="text-sm text-muted-foreground font-mono leading-relaxed relative z-10">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase mb-8">Execute trades with <span className="text-accent glow-text-primary">absolute certainty.</span></h2>
            
            <div className="space-y-8 font-mono">
              <div className="flex gap-4">
                <div className="w-8 h-8 shrink-0 bg-background border border-border flex items-center justify-center text-primary font-bold">01</div>
                <div>
                  <h4 className="text-lg font-bold text-foreground mb-1">/MM REQUEST</h4>
                  <p className="text-sm text-muted-foreground">User initiates a command. Bot instantly provisions a private ticket channel locking in both parties and pinging available staff.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 shrink-0 bg-background border border-border flex items-center justify-center text-primary font-bold">02</div>
                <div>
                  <h4 className="text-lg font-bold text-foreground mb-1">ASSET VERIFICATION</h4>
                  <p className="text-sm text-muted-foreground">Staff oversees the transfer. Automated logs record every message, attachment, and timestamp for auditing.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 shrink-0 bg-background border border-primary flex items-center justify-center text-background bg-primary font-bold glow-box-primary">03</div>
                <div>
                  <h4 className="text-lg font-bold text-foreground mb-1">SESSION TERMINATION</h4>
                  <p className="text-sm text-muted-foreground">Trade concludes. Bot archives the transcript, prompts for vouches, and nukes the channel. Clean slate.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-card border border-border p-6 font-mono text-sm relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-primary to-accent opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-background border border-border/50 p-4">
              <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-2">
                <div className="w-3 h-3 rounded-full bg-destructive"></div>
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="ml-2 text-xs text-muted-foreground">DISCORD_TERMINAL</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-primary">{'>'}</span>
                  <span className="text-muted-foreground">User_A executed /mm</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent">{'[SYSTEM]'}</span>
                  <span className="text-foreground">Provisioning ticket-8492...</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent">{'[SYSTEM]'}</span>
                  <span className="text-foreground">Channel created. Pinging @Middleman</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-primary">{'>'}</span>
                  <span className="text-muted-foreground">Staff_Mod executed /close</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent">{'[SYSTEM]'}</span>
                  <span className="text-foreground">Archiving transcript. Uploading to secure server.</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent">{'[SYSTEM]'}</span>
                  <span className="text-foreground">Channel deleted. Transaction complete.</span>
                </div>
                <div className="flex gap-3 animate-pulse">
                  <span className="text-primary">{'_'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="py-24 bg-card/50 border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
             <img 
              src="/security-lock.png" 
              alt="Security Infrastructure" 
              className="w-full max-w-md mx-auto aspect-square object-cover rounded-sm border border-primary/20"
              data-testid="img-security"
            />
          </div>
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-accent/30 text-accent text-xs font-mono w-fit mb-6">
              <Lock className="w-3 h-3" />
              ZERO-TRUST ARCHITECTURE
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase mb-6">Fortified against <br/>social engineering.</h2>
            <p className="font-mono text-muted-foreground mb-8">
              Scammers thrive in chaos. BloxBlitz enforces order. Every command is logged, every ticket is isolated, and impersonation is rendered impossible through strict role-binding.
            </p>
            
            <ul className="space-y-4 font-mono text-sm">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Anti-impersonation checks on all commands</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Automated transcript backups to off-site storage</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Hardened permission scaling for staff tiers</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>No redundant permissions required from Discord</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 relative border-t border-border overflow-hidden">
      <div className="absolute inset-0 bg-primary/5"></div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6 glow-text-primary">Initialize Sequence.</h2>
        <p className="font-mono text-muted-foreground max-w-xl mx-auto mb-10 text-lg">
          Stop relying on manual setup and vulnerable workflows. Deploy BloxBlitz and standardize your trading operations today.
        </p>
        
        <Button size="lg" className="h-16 px-12 font-mono text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-none glow-box-primary w-full sm:w-auto" asChild>
          <a href="https://discord.com/oauth2/authorize?client_id=1499011937256734771&permissions=268561488&scope=bot%20applications.commands" target="_blank" rel="noreferrer" data-testid="link-add-discord-footer">
            ADD TO DISCORD <Zap className="w-6 h-6 ml-2" />
          </a>
        </Button>
        <div className="mt-6 font-mono text-xs text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          SERVERS OPERATIONAL. READY FOR DEPLOYMENT.
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 border-t border-border bg-background">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span>BLOXBLITZ_OS v2.4.1</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-primary transition-colors">TERMS</a>
          <a href="#" className="hover:text-primary transition-colors">PRIVACY</a>
          <a href="#" className="hover:text-primary transition-colors">SUPPORT</a>
        </div>
        <div>
          <span>SYSTEM_STATUS: <span className="text-primary">NOMINAL</span></span>
        </div>
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Workflow />
        <Security />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={Home} />
              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
