const Imap = require('imap');
const { simpleParser } = require('mailparser');

const imapConfig = {
  user: 'fatih@schengenvizeal.com',
  password: 'w0-8ok=%tvAP',
  host: 'imap.turkticaret.net',
  port: 993,
  tls: true
};

module.exports.getLastMail = async function() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);

    function openInbox(cb) {
      imap.openBox('INBOX', true, cb);
    }

    imap.once('ready', function() {
      openInbox(function(err, box) {
        if (err) {
          imap.end();
          return resolve({ timestamp: 0 });
        }

        imap.search(['ALL'], function(err, results) {
          if (err) {
            imap.end();
            return resolve({ timestamp: 0 });
          }
          if (results.length === 0) {
            imap.end();
            return resolve({ timestamp: 0 });
          }

          const f = imap.fetch(results.slice(-1), { bodies: '' });
          f.on('message', function(msg, seqno) {
            msg.on('body', function(stream, info) {
              simpleParser(stream, (err, mail) => {
                if (err) {
                  imap.end();
                  return resolve({ timestamp: 0 });
                }
                const mailInfo = {
                  from: mail.from.value[0].address,
                  subject: mail.subject,
                  date: mail.date,
                  mail: mail.text,
                  timestamp: mail.date.getTime()
                };
                resolve(mailInfo);
              });
            });
          });

          f.once('error', function(err) {
            resolve({ timestamp: 0 });
          });

          f.once('end', function() {
            imap.end();
          });
        });
      });
    });

    imap.once('error', function(err) {
      resolve({ timestamp: 0 });
    });

    imap.once('end', function() {
      // console.log('Connection ended');
    });

    imap.connect();
  });
};
module.exports.getLastMail()
module.exports.extractOTP = function(mailText) {
  const otpRegex = /OTP for your application with VFS Global is (\d{6})/;
  const match = mailText.match(otpRegex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}