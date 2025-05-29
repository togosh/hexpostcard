# 🐧 Ubuntu Server Deployment Guide

## **Server Requirements**

### **Minimum Specs (Current):**
- **RAM**: 1GB (workable but tight)
- **CPU**: 1 vCPU
- **Storage**: 10GB SSD

### **Recommended Specs:**
- **RAM**: 2GB (much safer)
- **CPU**: 1-2 vCPU  
- **Storage**: 20GB SSD

## **🚨 1GB RAM Considerations**

Your current setup **will work** but has limitations:

### **✅ What Works:**
- Node.js heap limited to 512MB
- System gets ~400-500MB for OS/other processes
- Memory monitoring every 15 seconds
- Automatic cleanup and garbage collection

### **⚠️ Risks with 1GB:**
- **Memory pressure** during traffic spikes
- **Slower performance** due to frequent garbage collection
- **OS swap usage** if memory gets tight
- **Limited headroom** for system updates/maintenance

### **🚀 Benefits of Upgrading to 2GB:**
- **Double the safety margin**
- **Better performance** under load
- **Room for growth** (more donations, features)
- **Easier maintenance** without memory pressure

## **📋 Ubuntu Deployment Steps**

### **1. System Preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pm2 for process management (alternative to forever)
sudo npm install -g pm2

# Install forever (if you prefer)
sudo npm install -g forever
```

### **2. Deploy Your Code**
```bash
# Upload your code to server
cd /var/www/
sudo git clone [your-repo] hexpostcard
# OR: scp/rsync your local files

cd hexpostcard
sudo chown -R $USER:$USER .
npm install
```

### **3. Configure for Production**
```bash
# Test the health check
npm run health-check

# Start with pm2 (recommended for Ubuntu)
pm2 start npm --name "hexpostcard" -- run production

# OR start with forever
forever start -l forever.log -o out.log -e err.log npm run production
```

### **4. Monitor Memory**
```bash
# In separate terminal/tmux session
npm run monitor

# Check system memory
free -h
htop
```

## **📊 Memory Monitoring in Forever/PM2**

### **Forever Logs:**
All memory alerts will appear in:
- `forever.log` - General process logs
- `out.log` - stdout (includes memory warnings)
- `err.log` - stderr (critical memory errors)

### **PM2 Logs:**
```bash
pm2 logs hexpostcard
pm2 monit  # Real-time monitoring
```

### **Memory Log Files:**
- `memory-monitor.log` - Detailed memory tracking
- Console output captured by forever/pm2

## **🔍 Log Examples You'll See**

### **Normal Operation:**
```
[MEMORY] RSS: 180MB, Heap: 120MB, External: 15MB
2025-05-29T11:00:00.000Z [MainServer] --- Donation processing completed: 5 new donations
```

### **Memory Warnings:**
```
[MEMORY WARNING] Memory usage: 420MB (Warning threshold: 400MB)
[MEMORY] Forcing garbage collection...
[MEMORY] Memory after GC: RSS: 350MB, Heap: 200MB
```

### **Critical Alerts:**
```
[MEMORY CRITICAL] Memory usage 520MB exceeds critical limit 500MB! Count: 3
🚨 HIGH MEMORY ALERT: 520MB (Threshold: 400MB)
[CRASH PREVENTION] High memory usage detected, implementing safeguards
```

## **⚡ Performance Optimization for 1GB**

### **System Tuning:**
```bash
# Reduce swap usage (only use swap when absolutely necessary)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# Optimize memory allocation
echo 'vm.overcommit_memory=1' | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### **Monitoring Commands:**
```bash
# Check memory usage
free -h
cat /proc/meminfo | grep -E "MemTotal|MemAvailable|Cached"

# Monitor Node.js process
ps aux | grep node
htop -p $(pgrep node)

# Check forever/pm2 status
forever list
# OR
pm2 status
```

## **🚨 When to Upgrade to 2GB**

### **Immediate Signs:**
- Memory warnings every few minutes
- Slow response times (>2 seconds)
- Frequent garbage collection messages
- System swap usage >100MB

### **Monitoring Thresholds:**
- **Upgrade if**: Memory consistently >450MB
- **Upgrade if**: >10 memory warnings per hour
- **Upgrade if**: Response times >3 seconds

### **Cost/Benefit:**
- **Cost**: Usually $5-10/month more
- **Benefit**: 2x performance, reliability, future-proofing

## **🔧 Commands for Ubuntu**

```bash
# Health check before deployment
npm run health-check

# Start production (optimized for 1GB)
npm run production

# Monitor memory usage
npm run monitor

# Check logs
tail -f memory-monitor.log
forever logs 0  # or pm2 logs

# Restart if needed
forever restart 0  # or pm2 restart hexpostcard

# Emergency stop
forever stopall  # or pm2 stop hexpostcard
```

## **📈 Recommendation**

For **production stability**, I recommend upgrading to **2GB RAM**:

1. **Current**: Works but requires careful monitoring
2. **2GB**: Much more stable, better performance
3. **Future**: Room for growth and new features

The memory optimizations will work on 1GB, but 2GB gives you much better peace of mind and performance!
