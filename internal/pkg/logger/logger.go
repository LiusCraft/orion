package logger

import (
	"os"

	"github.com/sirupsen/logrus"
)

var log *logrus.Logger

func Init(mode string) {
	log = logrus.New()

	// 设置输出
	log.SetOutput(os.Stdout)

	// 根据模式设置日志级别和格式
	if mode == "release" {
		log.SetLevel(logrus.InfoLevel)
		log.SetFormatter(&logrus.JSONFormatter{})
	} else {
		log.SetLevel(logrus.DebugLevel)
		log.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
			ForceColors:   true,
		})
	}
}

func Debug(format string, args ...interface{}) {
	log.Debugf(format, args...)
}

func Info(format string, args ...interface{}) {
	log.Infof(format, args...)
}

func Warn(format string, args ...interface{}) {
	log.Warnf(format, args...)
}

func Error(format string, args ...interface{}) {
	log.Errorf(format, args...)
}

func Fatal(format string, args ...interface{}) {
	log.Fatalf(format, args...)
}

func WithFields(fields logrus.Fields) *logrus.Entry {
	return log.WithFields(fields)
}

func GetLogger() *logrus.Logger {
	return log
}
