// 2D nearest-neighbor scalar mass-spring lattice, started from exact rest.
// Centered damped leapfrog; material interface bonds use harmonic means.
// Build: g++ -O3 -std=c++17 simulate.cpp -o simulate
// Run from this directory after python configure.py: ./simulate
#include "parameters.h"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
constexpr int NX=1250, NY=401, C0=522, C1=762;
#ifndef SIM_DT
#define SIM_DT .3
#endif
#ifndef SIM_PERIODS
#define SIM_PERIODS 60
#endif
#ifndef CONTROL_RUNS
#define CONTROL_RUNS 2
#endif
constexpr double DT=SIM_DT, T=80., END=SIM_PERIODS*T;
struct Source{int x,y;double center,sigma,amp; vector<pair<int,double>> weights;};
double pulse(const Source&s,double t){double z=(t-s.center)/s.sigma;if(abs(z)>4)return 0.;return s.amp*(1-z*z)*exp(-z*z/2);}
double hm(double a,double b){return 2*a*b/(a+b);}
int main(){
 ifstream input("input.txt");int nf=0,ns=0;
 if(!(input>>nf>>ns)||nf<1||nf>100000||ns<1||ns>1000){cerr<<"Invalid input.txt; run configure.py first\n";return 1;}
 vector<double> times(nf);double last=-1;
 for(auto&t:times){if(!(input>>t)||!isfinite(t)||t<0||t<last){cerr<<"Invalid frame times\n";return 1;}last=t;}
 if(times[0]!=0){cerr<<"First frame must be zero\n";return 1;}
 vector<Source> sources(ns);
 for(auto&s:sources){if(!(input>>s.x>>s.y>>s.center>>s.sigma>>s.amp)||s.x<5||s.x>=NX-5||s.y<5||s.y>=NY-5||!isfinite(s.center)||!isfinite(s.sigma)||!isfinite(s.amp)||s.sigma<=0){cerr<<"Invalid source\n";return 1;}double sum=0;
   for(int dy=-4;dy<=4;dy++)for(int dx=-4;dx<=4;dx++){double z=exp(-(dx*dx+dy*dy)/4.5);s.weights.push_back({(s.y+dy)*NX+s.x+dx,z});sum+=z;}
   for(auto&w:s.weights)w.second/=sum;}
 ofstream diag("diagnostics.csv");diag<<setprecision(16)<<"control,time,energy_cavity,total_energy,work,dissipation,balance_error,field_max\n";
 ofstream movie("field.bin",ios::binary), slice("section.bin",ios::binary);
 if(!diag||!movie||!slice){cerr<<"Cannot open outputs\n";return 1;}
 for(int control=0;control<CONTROL_RUNS;control++){
   vector<double> mass(NX,1),km(NX,1),kx(NX-1,1),gx(NX),gy(NY),den(NX*NY),prev(NX*NY),u(NX*NY),next(NX*NY),force(NX*NY);
   if(!control){for(int a:{440,474,508,762,796})for(int x=a;x<a+14;x++){mass[x]=LAYER_MASS;km[x]=LAYER_STIFFNESS;}}
   for(int x=0;x<NX-1;x++)kx[x]=hm(km[x],km[x+1]);
   for(int x=0;x<NX;x++){if(x<300)gx[x]=.18*pow((300.-x)/300,3);if(x>=950)gx[x]=.18*pow((x-949.)/300,3);}
   for(int y=0;y<NY;y++){if(y<100)gy[y]=.12*pow((100.-y)/100,3);if(y>300)gy[y]=.12*pow((y-300.)/100,3);}
   for(int y=0;y<NY;y++)for(int x=0;x<NX;x++)den[y*NX+x]=1/(1+(gx[x]+gy[y])*DT/2);
   int fi=0;double work=0,diss=0,maxbalance=0,maxfield=0;
   vector<float> frame;frame.reserve(271*101);vector<float> sec(541);
   // Initial frame: all sites at rest.
   if(!control){frame.assign(271*101,0);movie.write((char*)frame.data(),frame.size()*4);slice.write((char*)sec.data(),sec.size()*4);fi=1;}
   diag<<control<<",0,0,0,0,0,0,0\n";
   for(int step=0;step*DT<END;step++){
     double now=step*DT;
     for(auto&s:sources)for(auto&w:s.weights)force[w.first]=0;
     for(auto&s:sources){double a=pulse(s,now);for(auto&w:s.weights)force[w.first]+=a*w.second;}
     double dwork=0,ddiss=0;
     for(int y=1;y<NY-1;y++){
       int row=y*NX;double gyf=gy[y];
       for(int x=1;x<NX-1;x++){
         int i=row+x;double g=gx[x]+gyf;
         double elastic=kx[x]*(u[i+1]-u[i])-kx[x-1]*(u[i]-u[i-1])+km[x]*(u[i+NX]+u[i-NX]-2*u[i]);
         next[i]=(2*u[i]-(1-g*DT/2)*prev[i]+DT*DT*(elastic+force[i])/mass[x])*den[i];
         double vc=(next[i]-prev[i])/(2*DT);
         dwork+=force[i]*vc*DT;ddiss+=mass[x]*g*vc*vc*DT;
       }
     }
     work+=dwork;diss+=ddiss;
     while(!control && fi<nf && times[fi]<=now+DT+1e-9){
       double f=(times[fi]-now)/DT;frame.clear();
       for(int y=100;y<=300;y+=2)for(int x=400;x<=940;x+=2){int i=y*NX+x;frame.push_back(float(u[i]*(1-f)+next[i]*f));}
       for(int x=400;x<=940;x++){int i=200*NX+x;sec[x-400]=float(u[i]*(1-f)+next[i]*f);}
       movie.write((char*)frame.data(),frame.size()*4);slice.write((char*)sec.data(),sec.size()*4);fi++;
     }
     if(step%16==0 || now+DT>=END){
       double energy=0,ecav=0,mx=0;
       for(int y=0;y<NY;y++)for(int x=0;x<NX;x++){
         int i=y*NX+x;double v=(next[i]-u[i])/DT;
         double e=.5*mass[x]*v*v;
         // Half of the cross-time spring energy at each end of every bond.
         if(x<NX-1)e+=.25*kx[x]*(next[i+1]-next[i])*(u[i+1]-u[i]);
         if(x>0)e+=.25*kx[x-1]*(next[i]-next[i-1])*(u[i]-u[i-1]);
         if(y<NY-1)e+=.25*km[x]*(next[i+NX]-next[i])*(u[i+NX]-u[i]);
         if(y>0)e+=.25*km[x]*(next[i]-next[i-NX])*(u[i]-u[i-NX]);
         energy+=e;if(x>=C0&&x<C1&&y>=100&&y<=300)ecav+=e;
         mx=max(mx,abs(next[i]));
       }
       double balance=energy+diss-work;maxbalance=max(maxbalance,abs(balance));maxfield=max(maxfield,mx);
       diag<<control<<","<<now+DT/2<<","<<ecav<<","<<energy<<","<<work<<","<<diss<<","<<balance<<","<<mx<<"\n";
     }
     prev.swap(u);u.swap(next);
     if(step%4000==0)cout<<"control="<<control<<" period="<<now/T<<"\n"<<flush;
   }
   cout<<"DONE control="<<control<<" frames="<<fi<<" work="<<work<<" balance="<<maxbalance<<" maxfield="<<maxfield<<"\n"<<flush;
 }
}
