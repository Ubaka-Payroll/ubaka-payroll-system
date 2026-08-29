import fs from 'fs'
import path from 'path'

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
}

interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    context?: Record<string, any>
    error?: Error
}

export interface RecentLogEntry {
    timestamp: string
    level: LogLevel
    message: string
    context?: Record<string, any>
}

const RECENT_ENTRIES_LIMIT = 200

class Logger {
    private logDir: string
    private appLogFile: string
    private errorLogFile: string
    private recentEntries: RecentLogEntry[] = []

    constructor() {
        this.logDir = path.join(__dirname, '../../logs')
        this.appLogFile = path.join(this.logDir, 'app.log')
        this.errorLogFile = path.join(this.logDir, 'error.log')
        this.ensureLogDirectory()
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true })
        }
    }

    private formatLogEntry(entry: LogEntry): string {
        const { timestamp, level, message, context, error } = entry
        let logMessage = `[${timestamp}] [${level}] ${message}`

        if (context && Object.keys(context).length > 0) {
            logMessage += ` | Context: ${JSON.stringify(context)}`
        }

        if (error) {
            logMessage += `\n  Error: ${error.message}\n  Stack: ${error.stack}`
        }

        return logMessage
    }

    private writeLog(filePath: string, content: string): void {
        try {
            fs.appendFileSync(filePath, content + '\n', 'utf8')
        } catch (err) {
            console.error('Failed to write to log file:', err)
        }
    }

    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error,
        }

        const formattedLog = this.formatLogEntry(entry)

        // Console output
        if (process.env.NODE_ENV !== 'production') {
            const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log'
            console[consoleMethod](formattedLog)
        }

        // File output
        this.writeLog(this.appLogFile, formattedLog)

        // Error file output
        if (level === LogLevel.ERROR && error) {
            this.writeLog(this.errorLogFile, formattedLog)
        }

        // In-memory ring buffer for the sysadmin dashboard's recent-events feed
        this.recentEntries.push({ timestamp: entry.timestamp, level, message, context })
        if (this.recentEntries.length > RECENT_ENTRIES_LIMIT) {
            this.recentEntries.splice(0, this.recentEntries.length - RECENT_ENTRIES_LIMIT)
        }

        // Rotate logs if they get too large (> 10MB)
        this.rotateLogsIfNeeded()
    }

    public getRecent(opts?: { level?: LogLevel; limit?: number }): RecentLogEntry[] {
        let entries = this.recentEntries
        if (opts?.level) {
            entries = entries.filter((e) => e.level === opts.level)
        }
        const limit = opts?.limit ?? RECENT_ENTRIES_LIMIT
        return entries.slice(-limit).reverse()
    }

    private rotateLogsIfNeeded(): void {
        const maxSize = 10 * 1024 * 1024 // 10MB
        const files = [this.appLogFile, this.errorLogFile]

        files.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file)
                if (stats.size > maxSize) {
                    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
                    const archivePath = file.replace('.log', `.${timestamp}.log`)
                    fs.renameSync(file, archivePath)
                }
            }
        })
    }

    public info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context)
    }

    public warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context)
    }

    public error(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, error)
    }

    public debug(message: string, context?: Record<string, any>): void {
        if (process.env.NODE_ENV !== 'production') {
            this.log(LogLevel.DEBUG, message, context)
        }
    }

    // HTTP Request logging
    public logRequest(method: string, url: string, statusCode: number, duration: number): void {
        this.info(`${method} ${url} - ${statusCode} (${duration}ms)`)
    }

    // Database operation logging
    public logDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
        const level = success ? LogLevel.INFO : LogLevel.ERROR
        const message = `DB ${operation} on ${table} - ${success ? 'Success' : 'Failed'} (${duration}ms)`
        this.log(level, message)
    }

    // Worker registration logging
    public logWorkerRegistration(workerId: number, workerNumber: string): void {
        this.info('Worker registered', { workerId, workerNumber })
    }

    // Attendance event logging
    public logAttendanceEvent(workerId: number, eventType: string): void {
        this.info('Attendance event recorded', { workerId, eventType })
    }

    // Error logging with context
    public logError(message: string, error: Error, context?: Record<string, any>): void {
        this.error(message, error, context)
    }
}

// Export singleton instance
export const logger = new Logger()
